"""Local-only request editing checks using synthetic stores and customer data. Build first."""
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
with tempfile.TemporaryDirectory(prefix='toyota-request-edit-') as tmp:
 log=open('/tmp/toyota-request-edit-test.log','w')
 p=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',tmp,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--var','ADMIN_AUTH_SECRET:local-test-signing-secret','--var','ADMIN_USERNAME:test-admin','--var',f'INTERNAL_STORAGE_URL:http://127.0.0.1:{bridge.server_port}','--var','INTERNAL_STORAGE_TOKEN:local-test-token'],cwd=ROOT,stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:
    if call('/api/stores')[0]==200:break
   except Exception:pass
   time.sleep(.5)
  else:raise AssertionError('Local runtime failed to start')
  time.sleep(8)
  def member(slug):
   c=conn.execute("INSERT INTO members(email,password_hash,display_name,phone,brands,store_slug,created_at) VALUES(?,?,?,?,?,?,?)",(slug+'@example.test','disabled','Synthetic store','+213555123456','["Toyota","Nissan"]',slug,'2026-01-01'))
   member_id=c.lastrowid;conn.commit()
   value=base64.urlsafe_b64encode(json.dumps({'id':member_id,'exp':int(time.time()*1000)+600000}).encode()).decode().rstrip('=')
   sig=base64.urlsafe_b64encode(hmac.new(b'local-test-signing-secret',('member:'+value).encode(),hashlib.sha256).digest()).decode().rstrip('=')
   return member_id,'toyota_member_session='+value+'.'+sig
  alice_id,alice=member('edit-alice');bob_id,bob=member('edit-bob')
  c=conn.execute("INSERT INTO leads(owner_id,name,phone,part_name,brand,model,year,note,order_type,quantity,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",(alice_id,'Synthetic customer','+213555123456','Test part','Toyota','Corolla',2014,'Original customer message','single',1,'2026-01-02T12:00:00Z'))
  request_id=c.lastrowid;conn.commit();path=f'/api/store-requests/{request_id}'
  def row():return dict(conn.execute('SELECT * FROM leads WHERE id=?',(request_id,)).fetchone())
  original=row()
  assert call(path,'PATCH',{'adminNote':'Private note'})[0]==401
  assert call(path,'PATCH',{'adminNote':'Private note'},bob)[0]==404
  assert call(path,'PATCH',{'adminNote':'Private note'},alice,'https://foreign.test')[0]==403
  for invalid in [{'owner_id':bob_id},{'note':'Overwrite customer message'},{'image_key':'other-image'},{'created_at':'changed'},{'id':2},{'source':'changed'},{'adminNote':{}},{'adminNote':'x'*5001},{'phone':'123'},{'vinFrame':'<script>'},{'year':True},{'year':'1949'},{'quantity':0},{'quantity':1.5},{'quantity':True},{'orderType':'unknown'},{'status':'bad'},{}]:
   response=call(path,'PATCH',invalid,alice);assert response[0]==400,(invalid,response)
  assert row()==original
  changes={'name':'Edited customer','phone':'0666123456','brand':'Nissan','partName':'Edited part','reference':'REF-EDIT','model':'Micra','year':'2020','vinFrame':'abc-123','orderType':'wholesale','quantity':'10','adminNote':'Called customer.\nWaiting for reference.'}
  result=call(path,'PATCH',changes,alice);assert result[0]==200,result
  saved=call('/api/store-requests',cookie=alice)[1][0]
  assert saved['id']==request_id and saved['name']=='Edited customer' and saved['phone']=='+213666123456'
  assert saved['brand']=='Nissan' and saved['model']=='Micra' and saved['year']==2020 and saved['vin_frame']=='ABC-123'
  assert saved['reference']=='REF-EDIT' and saved['part_name']=='Edited part' and saved['quantity']==10 and saved['order_type']=='wholesale'
  assert saved['admin_note']==changes['adminNote'] and saved['note']==original['note']
  assert saved['created_at']==original['created_at'] and saved['owner_id']==alice_id
  assert conn.execute('SELECT COUNT(*) FROM leads').fetchone()[0]==1
  assert call('/api/store-requests',cookie=bob)[1]==[]
  assert call('/api/store-requests')[0]==401
  assert 'admin_note' not in json.dumps(call('/api/stores/edit-alice')[1])
  assert call(path,'PATCH',{'quantity':''},alice)[0]==400
  assert row()['quantity']==10
  assert call(path,'PATCH',{'archived':True,'status':'confirmed'},alice)[0]==200
  assert call(path,'PATCH',{'adminNote':'Follow-up while archived'},alice)[0]==200
  assert call('/api/store-requests',cookie=alice)[1]==[]
  archived=call('/api/store-requests?view=archived',cookie=alice)[1][0]
  assert archived['admin_note']=='Follow-up while archived' and archived['order_status']=='confirmed' and archived['archived_at']
  assert call(path,'PATCH',{'archived':False,'orderType':'single'},alice)[0]==200
  assert row()['quantity']==1 and row()['admin_note']=='Follow-up while archived'
  assert call(path,'PATCH',{'adminNote':'','reference':'','year':'','vinFrame':''},alice)[0]==200
  assert row()['admin_note'] is None and row()['reference'] is None and row()['year'] is None and row()['vin_frame'] is None
  # Historical incomplete wholesale requests must still accept a note-only edit.
  conn.execute("UPDATE leads SET order_type='wholesale',quantity=NULL WHERE id=?",(request_id,));conn.commit()
  assert call(path,'PATCH',{'adminNote':'Legacy request follow-up'},alice)[0]==200
  assert row()['quantity'] is None and row()['note']==original['note']
  print('PASS: request edits persist, phones normalize, notes stay separate/private, invalid edits are atomic, tenants/CSRF protected, archive/status preserved and legacy requests accept notes',flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=10)
  bridge.shutdown();log.close()
