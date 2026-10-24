"""Local-only integration check: build first with pnpm build, then python scripts/test-members.py."""
import http.server,json,os,socket,sqlite3,subprocess,tempfile,threading,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
conn=sqlite3.connect(':memory:',check_same_thread=False)
conn.row_factory=sqlite3.Row
conn.executescript((ROOT/'scripts/railway-schema.sql').read_text())
lock=threading.Lock()
class Bridge(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
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
 try:r=opener.open(request,timeout=15)
 except urllib.error.HTTPError as e:r=e
 body=r.read();return r.status,json.loads(body) if body else {},r.headers
with tempfile.TemporaryDirectory(prefix='toyota-members-') as tmp:
 log=open(Path(tmp)/'runtime.log','w')
 p=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',tmp,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--var','ADMIN_AUTH_SECRET:local-test-signing-secret','--var',f'INTERNAL_STORAGE_URL:http://127.0.0.1:{bridge.server_port}','--var','INTERNAL_STORAGE_TOKEN:local-test-token'],cwd=ROOT,stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:
    if call('/api/search')[0]==200:break
   except Exception:pass
   time.sleep(.5)
  else:raise AssertionError('Local runtime failed to start')
  time.sleep(3)
  def register(email):
   status,body,headers=call('/api/account/auth','POST',{'action':'register','email':email,'password':'Local-test-Only-123','name':'متجر اختبار محلي','phone':'0555123456'})
   assert status==200,(status,body)
   cookie=headers['Set-Cookie'].split(';')[0]
   assert 'httponly' in headers['Set-Cookie'].lower() and 'samesite=lax' in headers['Set-Cookie'].lower()
   return cookie
  alice=register('alice@example.test');bob=register('bob@example.test')
  assert call('/api/inventory')[0]==401
  status,profile,_=call('/api/account',cookie=alice);assert status==200 and profile['phone']=='+213555123456'
  assert 'password_hash' not in profile
  assert call('/api/account','PUT',{'display_name':'المتجر الأول','phone':'0555123456','city':'تقرت','brands':['Toyota','Suzuki']},alice)[0]==200
  assert call('/api/account','PUT',{'display_name':'المتجر الثاني','phone':'0555123457','city':'الجزائر','brands':['Suzuki']},bob)[0]==200
  item={'name':'مضخة اختبار','brand':'Suzuki','reference':'LOCAL-123','compatibility':'Swift 2018–2024','price':'2500.50','quantity':'5','partType':'original'}
  status,created,_=call('/api/inventory','POST',item,alice);assert status==201,(status,created)
  item_id=created['id']
  assert call('/api/inventory',cookie=bob)[1]==[]
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'price':'1'},bob)[0]==404
  assert call(f'/api/inventory/{item_id}','DELETE',{},bob)[0]==404
  status,results,_=call('/api/search?q=LOCAL-123');assert status==200,(status,results)
  result=results['items'][0];assert result['price']=='2500.5' and result['seller_id']==profile['id'] and result['quantity']==5
  assert call('/api/search?q=Swift')[1]['items'][0]['id']==item_id
  public=call('/api/sellers/'+str(profile['id']))[1]
  assert 'email' not in public and 'password_hash' not in public and public['city']=='تقرت'
  assert call('/api/inventory','POST',{**item,'brand':'Nissan'},alice)[0]==400
  assert call('/api/inventory','POST',{**item,'price':'-1'},alice)[0]==400
  assert call('/api/inventory','POST',{**item,'quantity':'1.5'},alice)[0]==400
  assert call('/api/inventory','POST',item,alice,'https://untrusted.test')[0]==403
  assert call('/api/account',cookie=alice+'tampered')[0]==401
  assert call(f'/api/inventory/{item_id}','PUT',{**item,'quantity':'0'},alice)[0]==200
  assert call('/api/search?q=LOCAL-123')[1]['items']==[]
  assert call('/api/inventory',cookie=alice)[1][0]['quantity']==0
  assert call(f'/api/inventory/{item_id}','PUT',item,alice)[0]==200
  assert call(f'/api/inventory/{item_id}','DELETE',{},alice)[0]==200
  assert call('/api/search?q=LOCAL-123')[1]['items']==[]
  assert call('/api/inventory',cookie=alice)[1]==[]
  assert call('/api/account/auth','POST',{'action':'login','email':'alice@example.test','password':'Wrong-password'})[0]==401
  status,_,headers=call('/api/account/auth','POST',{'action':'login','email':'alice@example.test','password':'Local-test-Only-123'})
  assert status==200 and headers.get('Set-Cookie')
  assert call('/api/account/auth','POST',{'action':'logout'},alice)[2]['Set-Cookie'].find('Max-Age=0')>=0
  for _ in range(11):status,_,_=call('/api/account/auth','POST',{'action':'login','email':'blocked@example.test','password':'Wrong-password'})
  assert status==429
  with lock:
   hashes=[row[0] for row in conn.execute('SELECT password_hash FROM members')]
  assert len(set(hashes))==2 and all('Local-test' not in value for value in hashes)
  print('PASS: registration/login/logout, private profiles, brands, inventory ownership, search/prices, zero-stock/deleted filtering, CSRF, session tampering, password hashing, rate limits')
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait()
  bridge.shutdown();log.close()
