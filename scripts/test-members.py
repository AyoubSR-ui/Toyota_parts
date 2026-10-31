"""Local-only integration check: build first with pnpm build, then python scripts/test-members.py."""
import base64,hmac,hashlib,http.server,json,os,socket,sqlite3,subprocess,tempfile,threading,time,urllib.request,urllib.error,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
conn=sqlite3.connect(':memory:',check_same_thread=False)
conn.row_factory=sqlite3.Row
conn.executescript((ROOT/'scripts/railway-schema.sql').read_text())
conn.execute("INSERT INTO products (brand,name_en,name_ar,reference,price,image_key,created_at) VALUES ('Toyota','Legacy part','قطعة تويوتا الأصلية','LEGACY-TOYOTA','7300','products/legacy.png','2026-10-01')")
conn.executescript((ROOT/'scripts/founding-store.sql').read_text())
conn.executescript((ROOT/'scripts/founding-store.sql').read_text())
assert conn.execute("SELECT COUNT(*) FROM members WHERE store_slug='toyota-parts'").fetchone()[0]==1
assert conn.execute("SELECT COUNT(*) FROM inventory WHERE legacy_product_id=1").fetchone()[0]==1
lock=threading.Lock()
objects={}
class Bridge(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def object_request(self):
  if self.headers.get('Authorization')!='Bearer local-test-token':self.send_error(401);return
  key=urllib.parse.unquote(self.path.removeprefix('/objects/'))
  if self.command=='PUT':
   objects[key]=(self.rfile.read(int(self.headers['Content-Length'])),self.headers['Content-Type']);self.send_response(200);self.end_headers();self.wfile.write(b'{}')
  elif self.command=='DELETE':objects.pop(key,None);self.send_response(200);self.end_headers();self.wfile.write(b'{}')
  elif key in objects:
   data,mime=objects[key];self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(data)
  else:self.send_error(404)
 do_PUT=object_request
 do_GET=object_request
 do_DELETE=object_request
 def do_POST(self):
  if self.headers.get('Authorization')!='Bearer local-test-token':self.send_error(401);return
  try:
   d=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   with lock:
    cursor=conn.execute(d['sql'],d.get('params',[]))
    rows=[dict(row) for row in cursor.fetchall()] if cursor.description else []
    conn.commit()
    result={'results':rows,'meta':{'last_row_id':cursor.lastrowid,'changes':max(0,cursor.rowcount)}}
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(result).encode())
  except Exception as e:self.send_error(503,str(e))
bridge=http.server.ThreadingHTTPServer(('127.0.0.1',0),Bridge)
threading.Thread(target=bridge.serve_forever,daemon=True).start()
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def call(path,method='GET',data=None,cookie=None,request_origin=origin):
 headers={'Origin':request_origin}
 if data is not None:headers['Content-Type']='application/json'
 if cookie:headers['Cookie']=cookie
 request=urllib.request.Request(origin+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:r=opener.open(request,timeout=25)
 except urllib.error.HTTPError as e:r=e
 except (TimeoutError,urllib.error.URLError):
  if method!='GET':raise
  try:r=opener.open(request,timeout=25)
  except urllib.error.HTTPError as e:r=e
 body=r.read();
 try:parsed=json.loads(body) if body else {}
 except ValueError:parsed={'error':body.decode(errors='replace')[:200]}
 return r.status,parsed,r.headers
with tempfile.TemporaryDirectory(prefix='toyota-members-') as tmp:
 log=open('/tmp/toyota-members-test.log','w')
 p=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',tmp,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--var','ADMIN_AUTH_SECRET:local-test-signing-secret','--var','ADMIN_USERNAME:test-admin','--var',f'INTERNAL_STORAGE_URL:http://127.0.0.1:{bridge.server_port}','--var','INTERNAL_STORAGE_TOKEN:local-test-token'],cwd=ROOT,stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:
    if call('/api/stores')[0]==200:break
   except Exception:pass
   time.sleep(.5)
  else:raise AssertionError('Local runtime failed to start')
  time.sleep(8)
  def register(email):
   status,body,headers=call('/api/account/auth','POST',{'action':'register','email':email,'password':'Local-test-Only-123','name':'متجر اختبار محلي','phone':'0555123456'})
   assert status==200,(status,body)
   cookie=headers['Set-Cookie'].split(';')[0]
   assert 'httponly' in headers['Set-Cookie'].lower() and 'samesite=lax' in headers['Set-Cookie'].lower()
   return cookie
  payload=base64.urlsafe_b64encode(json.dumps({'user':'test-admin','exp':int(time.time()*1000)+600000}).encode()).decode().rstrip('=')
  signature=base64.urlsafe_b64encode(hmac.new(b'local-test-signing-secret',payload.encode(),hashlib.sha256).digest()).decode().rstrip('=')
  admin='toyota_admin_session='+payload+'.'+signature
  assert call('/api/account',cookie=admin)[0]==401
  toyota_id=conn.execute("SELECT id FROM members WHERE store_slug='toyota-parts'").fetchone()[0]
  assert call('/api/owner-setup','POST',{'action':'invite','id':toyota_id})[0]==401
  invitation=call('/api/owner-setup','POST',{'action':'invite','id':toyota_id},admin)[1]
  setup_values=urllib.parse.parse_qs(urllib.parse.urlparse(invitation['url']).fragment)
  setup={'action':'complete','id':toyota_id,'token':setup_values['token'][0],'email':'toyota-owner@example.test','password':'Local-test-Only-123'}
  assert call('/api/owner-setup','POST',{**setup,'token':'invalid'})[0]==400
  assert call('/api/owner-setup','POST',setup)[0]==200
  assert call('/api/owner-setup','POST',setup)[0]==400
  login=call('/api/account/auth','POST',{'action':'login','email':setup['email'],'password':setup['password']})
  assert login[0]==200
  toyota_cookie=login[2]['Set-Cookie'].split(';')[0]
  toyota=call('/api/account',cookie=toyota_cookie)[1]
  assert call('/api/platform-admin',cookie=toyota_cookie)[0]==401
  assert call('/api/inventory',cookie=admin)[0]==401
  assert call('/api/account','PUT',{'display_name':'Toyota Parts','phone':'0555123456','brands':['Toyota','Nissan'],'store_slug':'new-toyota'},toyota_cookie)[0]==400
  assert toyota['store_slug']=='toyota-parts' and toyota['account_type']=='member'
  assert call('/api/inventory',cookie=toyota_cookie)[1][0]['reference']=='LEGACY-TOYOTA'
  assert call('/api/stores/toyota-parts')[1]['products'][0]['price']=='7300'
  alice=register('alice@example.test');bob=register('bob@example.test')
  assert call('/api/inventory')[0]==401
  status,profile,_=call('/api/account',cookie=alice);assert status==200 and profile['phone']=='+213555123456'
  alice_slug=profile['store_slug']
  bob_profile=call('/api/account',cookie=bob)[1];bob_slug=bob_profile['store_slug']
  assert call('/api/search')[0]==400
  assert call('/api/account','PUT',{'display_name':'X','phone':'0555123456','brands':['Toyota'],'store_slug':bob_slug},alice)[0]==409
  assert call('/api/account','PUT',{'display_name':'X','phone':'0555123456','brands':['Toyota'],'store_slug':'toyota-parts'},alice)[0]==400
  assert call('/api/stores')[1]==[]
  assert call('/api/stores?q=%20%20')[1]==[]
  reference_profile={'display_name':'Alpha Test Parts','phone':'0555123456','brands':['Toyota'],'store_reference':' tp-alger-01 '}
  assert call('/api/account','PUT',reference_profile,alice)[0]==200
  assert call('/api/account',cookie=alice)[1]['store_reference']=='TP-ALGER-01'
  results=call('/api/stores?q=tp-ALGER-01')[1]
  assert len(results)==1 and results[0]['id']==profile['id'] and results[0]['store_reference']=='TP-ALGER-01'
  assert call('/api/stores?q=Alpha%20Test')[1][0]['id']==profile['id']
  assert call('/api/stores?q=Toyota')[1] and all('toyota' in store['display_name'].lower() for store in call('/api/stores?q=Toyota')[1])
  assert call('/api/stores?q=%25')[1]==[]
  assert call('/api/stores?q=%27%20OR%201%3D1--')[1]==[]
  assert call('/api/account','PUT',{**reference_profile,'store_reference':'TP-ALGER-01'},bob)[0]==409
  assert call('/api/account','PUT',{**reference_profile,'store_reference':'bad ref'},alice)[0]==400
  assert call('/api/account','PUT',{**reference_profile,'store_reference':'ab'},alice)[0]==400
  assert call('/api/account','PUT',{**reference_profile,'store_reference':''},alice)[0]==200
  assert call('/api/stores?q=tp-alger-01')[1]==[]
  assert call('/api/account','PUT',reference_profile,alice)[0]==200
  assert 'password_hash' not in results[0] and 'email' not in results[0]
  assert call('/api/platform-admin')[0]==401
  assert call('/api/platform-admin',cookie=alice)[0]==401
  assert call('/api/platform-admin','POST',{'action':'settings','brands':['X'],'support_email':''},alice)[0]==401
  assert call('/api/platform-admin',cookie=admin)[0]==200
  assert call('/api/platform-admin','POST',{'action':'settings','brands':['Custom','Toyota'],'support_email':'support@example.test'},admin,'https://evil.test')[0]==403
  assert call('/api/platform-admin','POST',{'action':'settings','brands':['Custom','Toyota'],'support_email':'support@example.test'},admin)[0]==200
  assert call('/api/platform/settings')[1]['brands']==['Custom','Toyota']
  assert call('/api/support','POST',{'name':'Local owner','phone':'0555123456','store_reference':'TP-ALGER-01','subject':'Local support test','message':'Please help with store setup'},alice)[0]==200
  ticket=call('/api/support',cookie=alice)[1][0]
  assert call('/api/support',cookie=bob)[1]==[]
  assert call('/api/platform-admin',cookie=admin)[1]['tickets'][0]['id']==ticket['id']
  assert call('/api/platform-admin','POST',{'action':'ticket-status','id':ticket['id'],'status':'resolved'},admin)[0]==200
  assert call('/api/support',cookie=alice)[1][0]['status']=='resolved'
  public_ticket={'name':'Guest customer','phone':'0555000001','store_reference':'TP-ALGER-01','subject':'Guest enquiry','message':'I need platform support without an account'}
  assert call('/api/support','POST',{**public_ticket,'phone':'invalid'})[0]==400
  assert call('/api/support','POST',{**public_ticket,'website':'spam.example'})[0]==400
  assert call('/api/support','POST',public_ticket,request_origin='https://untrusted.test')[0]==403
  status,guest_result,_=call('/api/support','POST',public_ticket)
  assert status==200 and guest_result['request_id']
  assert call('/api/support')[0]==401
  assert len(call('/api/support',cookie=alice)[1])==1
  guest=[t for t in call('/api/platform-admin',cookie=admin)[1]['tickets'] if t.get('name')=='Guest customer'][0]
  assert guest['owner_id'] is None and guest['phone']=='+213555000001' and guest['store_reference']=='TP-ALGER-01'
  for _ in range(5):guest_status=call('/api/support','POST',public_ticket)[0]
  assert guest_status==429

  assert call('/api/platform-admin','POST',{'action':'store-status','id':toyota['id'],'suspended':True},admin)[0]==200
  assert call('/api/account',cookie=toyota_cookie)[0]==401
  assert call('/api/platform-admin','POST',{'action':'store-status','id':toyota['id'],'suspended':False},admin)[0]==200
  assert call('/api/platform-admin','POST',{'action':'store-status','id':profile['id'],'suspended':True},admin)[0]==200
  assert call('/api/account',cookie=alice)[0]==401
  assert call('/api/inventory',cookie=alice)[0]==401
  assert call('/api/stores/'+alice_slug)[0]==404
  assert call('/api/account/auth','POST',{'action':'login','email':'alice@example.test','password':'Local-test-Only-123'})[0]==403
  assert call('/api/platform-admin','POST',{'action':'store-status','id':profile['id'],'suspended':False},admin)[0]==200
  assert call('/api/account',cookie=alice)[0]==200
  assert call('/api/stores/'+alice_slug)[0]==404
  assert call('/api/account','PUT',{'display_name':'Alpha Test Parts','phone':'0555123456','brands':['Toyota'],'is_published':True},alice)[0]==200
  assert 'password_hash' not in profile
  assert profile['background_color']=='#f5f6f8'
  assert call('/api/account','PUT',{'display_name':'المتجر الأول','phone':'0555123456','city':'تقرت','brands':['Toyota','Suzuki'],'background_color':'#17202b'},alice)[0]==200
  assert call('/api/account','PUT',{'display_name':'المتجر الثاني','phone':'0555123457','city':'الجزائر','brands':['Suzuki']},bob)[0]==200
  png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=')
  def upload_logo(cookie,content=png,mime='image/png'):
   boundary='local-logo-test-boundary'
   body=(f'--{boundary}\r\nContent-Disposition: form-data; name="logo"; filename="test.png"\r\nContent-Type: {mime}\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
   r=urllib.request.Request(origin+'/api/account/logo',method='POST',data=body,headers={'Origin':origin,'Cookie':cookie,'Content-Type':'multipart/form-data; boundary='+boundary})
   try:
    response=opener.open(r);response.read();return response.status
   except urllib.error.HTTPError as e:e.read();return e.code
  assert upload_logo(alice)==200
  updated=call('/api/account',cookie=alice)[1];assert updated['logo_url']
  logo=opener.open(origin+updated['logo_url']);assert logo.read()==png and logo.headers['Content-Type']=='image/png'
  assert call('/api/account',cookie=bob)[1]['logo_url'] is None
  assert upload_logo(alice,b'not a PNG')==400
  assert upload_logo('')==401
  logo_delete=call('/api/account/logo','DELETE',{},alice);assert logo_delete[0]==200,logo_delete[:2]
  assert call('/api/account',cookie=alice)[1]['logo_url'] is None
  assert upload_logo(alice)==200
  item={'name':'مضخة اختبار','brand':'Suzuki','reference':'LOCAL-123','compatibility':'Swift 2018–2024','price':'2500.50','quantity':'5','partType':'original','buyPrice':'1777.25','sku':'PRIVATE-SKU','country':'Japan','model':'Swift','years':'2018–2024','description':'Catalog description','nameEn':'Test pump','nameFr':'Pompe test','manufacturer':'AISIN','barcode':'1234567890123'}
  status,created,_=call('/api/inventory','POST',item,alice);assert status==201,(status,created)
  item_id=created['id']
  assert call('/api/inventory',cookie=bob)[1]==[]
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'price':'1'},bob)[0]==404
  assert call(f'/api/inventory/{item_id}','DELETE',{},bob)[0]==404
  status,results,_=call('/api/search?seller='+str(profile['id'])+'&q=LOCAL-123');assert status==200,(status,results)
  result=results['items'][0];assert result['price']=='2500.5' and result['quantity']==5
  assert 'buy_price' not in result and '1777.25' not in json.dumps(results)
  assert result['sku'] is None
  assert call('/api/inventory',cookie=alice)[1][0]['buy_price']=='1777.25'
  assert call('/api/search?seller='+str(profile['id'])+'&q=Swift')[1]['items'][0]['id']==item_id
  assert call('/api/stores/'+bob_slug+'?view=inventory&q=LOCAL-123')[1]['products']==[]
  assert call('/api/stores/'+alice_slug+'?view=inventory&q=LEGACY-TOYOTA')[1]['products']==[]
  assert call('/api/search?seller='+str(profile['id'])+'&q=%25')[1]['items']==[]
  assert call('/api/inventory',cookie=alice)[1][0]['manufacturer']=='AISIN'
  assert call('/api/stores/'+alice_slug)[1]['products'][0]['manufacturer']=='AISIN'
  hidden={**item,'isFeatured':False,'showPrice':False,'catalogFields':{'price':False,'reference':False,'country':False,'quantity':False,'description':False,'manufacturer':False,'barcode':False}}
  assert call(f'/api/inventory/{item_id}','PUT',hidden,alice)[0]==200
  assert call('/api/stores/'+alice_slug)[1]['products']==[]
  stock_result=call('/api/stores/'+alice_slug+'?view=inventory&q=LOCAL-123')[1]['products'][0]
  assert stock_result['price'] is None and '2500' not in json.dumps(stock_result) and stock_result['reference'] is None and stock_result['quantity'] is None and stock_result['manufacture_country'] is None and stock_result['description'] is None and stock_result['manufacturer'] is None and stock_result['barcode'] is None
  assert call('/api/inventory',cookie=alice)[1][0]['price']=='2500.5'
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'showPrice':True,'isFeatured':True,'catalogFields':{}},alice)[0]==200
  settings=call('/api/form-settings?store='+alice_slug)[1]
  settings['fields']['note']['required']=True
  assert call('/api/form-settings?store='+alice_slug,'PUT',settings,bob)[0]==403
  response=call('/api/form-settings?store='+alice_slug,'PUT',settings,alice);assert response[0]==200,response[:2]
  lead=dict(name='Client A',phone='0555123456',brand='Suzuki',partName='Part enquiry A',model='Swift',year=2020,orderType='single',storeSlug=alice_slug)
  assert call('/api/leads','POST',lead)[0]==400
  assert call('/api/leads','POST',{**lead,'note':'For Alice only'})[0]==201
  assert call('/api/store-requests',cookie=alice)[1][0]['name']=='Client A'
  assert call('/api/store-requests',cookie=bob)[1]==[]
  assert call('/api/store-requests',cookie=admin)[0]==401
  assert call('/api/leads',cookie=admin)[1]==[]
  formB=call('/api/form-settings?store='+bob_slug)[1]
  assert formB['fields']['note']['required'] is False
  def page_status(path,cookie):
   try:return opener.open(urllib.request.Request(origin+path,headers={'Cookie':cookie}),timeout=25).status
   except urllib.error.HTTPError as e:e.read();return e.code
  assert page_status('/stores/'+bob_slug+'/admin',alice)==404
  assert page_status('/stores/'+alice_slug+'/admin',alice)==200
  qr=opener.open(urllib.request.Request(origin+'/api/account/qr?download=1',headers={'Cookie':alice}),timeout=25)
  assert qr.status==200 and qr.read().startswith(b'\x89PNG') and 'attachment' in qr.headers['Content-Disposition']
  assert page_status('/api/account/qr','')==401
  design={'display_name':'المتجر الأول','phone':'0555123456','city':'تقرت','brands':['Suzuki'],'hero_title_fr':'Pièces Suzuki','hero_text_fr':'Mon stock personnel','hero_background':'#14243a','accent_color':'#008080','layout':'list','show_prices':False}
  assert call('/api/account','PUT',design,alice)[0]==200
  themed=call('/api/stores/'+alice_slug+'?view=inventory')[1]
  assert themed['store']['hero_title_fr']=='Pièces Suzuki' and themed['store']['accent_color']=='#008080' and themed['products'][0]['price'] is None
  assert call('/api/account','PUT',{**design,'is_published':False},alice)[0]==200
  assert call('/api/stores/'+alice_slug)[0]==404
  assert call('/api/search?seller='+str(profile['id']))[0]==404
  assert not any(store['store_slug']==alice_slug for store in call('/api/stores?q=tp-alger-01')[1])
  assert call('/api/account','PUT',{**design,'is_published':True,'show_prices':True},alice)[0]==200

  def upload_product(cookie):
   boundary='product-fixture-boundary'
   body=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="part.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+f'\r\n--{boundary}--\r\n'.encode()
   request=urllib.request.Request(origin+f'/api/inventory/{item_id}/image',data=body,method='POST',headers={'Cookie':cookie,'Origin':origin,'Content-Type':'multipart/form-data; boundary='+boundary})
   try:response=opener.open(request,timeout=25);response.read();return response.status
   except urllib.error.HTTPError as e:e.read();return e.code
  assert upload_product(bob)==404
  assert upload_product(alice)==200
  product_image=opener.open(origin+f'/api/inventory/{item_id}/image',timeout=25)
  assert product_image.read()==png
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'catalogFields':{'image':False}},alice)[0]==200
  assert page_status(f'/api/inventory/{item_id}/image','')==404
  assert page_status(f'/api/inventory/{item_id}/image',alice)==200
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'catalogFields':{}},alice)[0]==200
  public=call('/api/sellers/'+str(profile['id']))[1]
  assert 'email' not in public and 'password_hash' not in public and public['city']=='تقرت'
  assert public['background_color']=='#17202b'
  assert public['display_name']=='المتجر الأول'
  assert call('/api/account','PUT',{'display_name':'المتجر الأول','phone':'0555123456','brands':['Toyota','Suzuki'],'background_color':'url(evil)'},alice)[0]==400
  assert call('/api/account',cookie=alice)[1]['background_color']=='#17202b'
  assert call('/api/account','PUT',{'display_name':'المتجر الأول','phone':'0555123456','city':'تقرت','brands':['Suzuki'],'background_color':'#eaf1fb'},alice)[0]==200
  assert call('/api/account',cookie=alice)[1]['brands']==['Suzuki']
  assert call('/api/account','PUT',{'display_name':'المتجر الأول','phone':'0555123456','brands':[]},alice)[0]==400
  assert call('/api/inventory','POST',{**item,'brand':'Nissan'},alice)[0]==400
  assert call('/api/inventory','POST',{**item,'price':'-1'},alice)[0]==400
  assert call('/api/inventory','POST',{**item,'quantity':'1.5'},alice)[0]==400
  assert call('/api/inventory','POST',item,alice,'https://untrusted.test')[0]==403
  assert call('/api/account',cookie=alice+'tampered')[0]==401
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'quantity':'0'},alice)[0]==200
  assert call('/api/search?seller='+str(profile['id'])+'&q=LOCAL-123')[1]['items']==[]
  assert call('/api/inventory',cookie=alice)[1][0]['quantity']==0
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'showPrice':True,'isFeatured':True,'catalogFields':{}},alice)[0]==200
  assert call(f'/api/inventory/{item_id}','DELETE',{},alice)[0]==200
  assert call('/api/search?seller='+str(profile['id'])+'&q=LOCAL-123')[1]['items']==[]
  assert call('/api/inventory',cookie=alice)[1]==[]
  assert call('/api/account/auth','POST',{'action':'login','email':'alice@example.test','password':'Wrong-password'})[0]==401
  status,_,headers=call('/api/account/auth','POST',{'action':'login','email':'alice@example.test','password':'Local-test-Only-123'})
  assert status==200 and headers.get('Set-Cookie')
  assert call('/api/account/auth','POST',{'action':'logout'},alice)[2]['Set-Cookie'].find('Max-Age=0')>=0
  for _ in range(11):status,_,_=call('/api/account/auth','POST',{'action':'login','email':'blocked@example.test','password':'Wrong-password'})
  assert status==429
  with lock:
   hashes=[row[0] for row in conn.execute('SELECT password_hash FROM members')]
  assert len(set(hashes))==3 and all('Local-test' not in value for value in hashes)
  print('PASS: registration/login/logout, private profiles, brands, inventory ownership, search/prices, zero-stock/deleted filtering, CSRF, session tampering, password hashing, rate limits, logo upload/read/remove and isolation, store name, brand removal, theme persistence and validation, tenant/store isolation, hidden public prices, featured inventory, private leads and settings, founding-store import, private dashboard routes, QR PNG generation, search-only store discovery and unique editable references, platform admin authorization, suspension, settings, private and public support, support validation and spam limits')
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait()
  bridge.shutdown();log.close()
