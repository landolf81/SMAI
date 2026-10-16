/** Run only against in-memory PGlite; no URL, credentials or production connection accepted. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
if(!process.argv[2])throw new Error('Pass a local @electric-sql/pglite dist/index.js path. No database URL is accepted.');
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
async function as(role,user,fn){
 assert.ok(['anon','authenticated','service_role'].includes(role));
 await db.exec(`SET ROLE ${role}`);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,...(user?{sub:user}:{})})]);
 try{return await fn();}finally{await db.exec('RESET ROLE');await db.exec("RESET request.jwt.claims");}
}
async function draft(name){
 const sql=await readFile(new URL(`../docs/security/${name}.sql`,import.meta.url),'utf8');
 await db.exec(sql.replace(/^BEGIN;\s*$/m,'').replace(/^ROLLBACK;\s*$/m,''));
}
try{
 await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 CREATE TABLE public.users(id uuid PRIMARY KEY,name text,username text DEFAULT 'fixture',status text DEFAULT 'active',can_report boolean DEFAULT true,verified boolean DEFAULT false,suspended_until timestamptz,suspension_reason text,deleted_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE public.admin_roles(user_id uuid,role text,created_at timestamptz DEFAULT now());
 CREATE TABLE public.posts(id bigint PRIMARY KEY,user_id uuid);
 CREATE TABLE public.trade_items(id bigint PRIMARY KEY,post_id bigint REFERENCES public.posts(id));
 CREATE TABLE public.market_alerts(id bigint PRIMARY KEY,user_id integer);
 CREATE TABLE public.messages(id bigserial PRIMARY KEY,conversation_id bigint,sender_id uuid,receiver_id uuid,content text,is_read boolean DEFAULT false,read_at timestamptz,created_at timestamptz,updated_at timestamptz);
 CREATE TABLE public.push_subscriptions(id uuid PRIMARY KEY,user_id uuid,endpoint text,keys jsonb);
 ALTER TABLE public.trade_items ENABLE ROW LEVEL SECURITY;ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
 CREATE POLICY trade_items_select_all ON public.trade_items FOR SELECT USING(true);
 CREATE POLICY trade_items_insert_authenticated ON public.trade_items FOR INSERT WITH CHECK(auth.uid() IS NOT NULL);
 CREATE POLICY trade_items_update_authenticated ON public.trade_items FOR UPDATE USING(auth.uid() IS NOT NULL);
 CREATE POLICY trade_items_delete_authenticated ON public.trade_items FOR DELETE USING(auth.uid() IS NOT NULL);
 CREATE POLICY messages_select_own ON public.messages FOR SELECT USING(auth.uid()=sender_id OR auth.uid()=receiver_id);
 CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK(auth.uid()=sender_id);
 CREATE POLICY messages_update_own ON public.messages FOR UPDATE USING(auth.uid()=sender_id OR auth.uid()=receiver_id);
 CREATE POLICY "Authenticated users can read all subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING(true);
 CREATE POLICY push_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK(auth.uid()=user_id);
 INSERT INTO public.users(id,name) VALUES('${owner}','owner'),('${other}','other');
 INSERT INTO public.posts VALUES(1,'${owner}'),(2,'${other}');
 INSERT INTO public.trade_items VALUES(1,1),(2,2);
 INSERT INTO public.messages(id,sender_id,receiver_id,content,created_at) VALUES(1,'${owner}','${other}','original',now());
 INSERT INTO public.push_subscriptions VALUES('${owner}','${owner}','https://push.example/owner','{}'),('${other}','${other}','https://push.example/other','{}');
 `);

await db.exec("CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\nAS $function$\r\nBEGIN\r\n  RETURN EXISTS (\r\n    SELECT 1 FROM admin_roles \r\n    WHERE user_id = (select auth.uid())\r\n  );\r\nEND;\r\n$function$\n");
await db.exec("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; CREATE POLICY users_select_all ON public.users FOR SELECT USING(true); CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK(auth.uid()=id); CREATE POLICY users_update_own ON public.users FOR UPDATE USING(auth.uid()=id); ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;CREATE POLICY admin_roles_admin_only ON public.admin_roles FOR ALL USING(public.is_admin());");
 await db.exec(await readFile(new URL('../supabase/migrations/20261016161714_approved_db_push_boundaries_20261016.sql',import.meta.url),'utf8'));
 await check('own public profile edit works; ordinary users cannot self-verify/unban or reset history',async()=>as('authenticated',owner,async()=>{
  await db.exec("UPDATE users SET name='owner edited' WHERE id='"+owner+"'");
  for(const set of ["verified=true","status='banned'","can_report=false","deleted_at=now()","created_at=now()"])
   await assert.rejects(db.exec(`UPDATE users SET ${set} WHERE id='${owner}'`));
 }));
 await check('trusted DB-owned welcome and soft-delete functions remain compatible',async()=>{
  await db.exec(`CREATE FUNCTION public.fixture_welcome() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$INSERT INTO public.messages(id,sender_id,receiver_id,content,created_at) VALUES(99,'${other}','${owner}','welcome',now())$$;
   CREATE FUNCTION public.fixture_soft_delete() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$UPDATE public.users SET deleted_at=now() WHERE id=auth.uid()$$;`);
  await as('authenticated',owner,async()=>{await db.query('SELECT fixture_welcome()');await db.query('SELECT fixture_soft_delete()');});
 });
 await check('owner trade insert works; foreign insert/update/delete denied',async()=>as('authenticated',owner,async()=>{
  await db.exec('INSERT INTO trade_items VALUES(3,1)');
  await assert.rejects(db.exec('INSERT INTO trade_items VALUES(4,2)'));
  assert.equal((await db.query('UPDATE trade_items SET post_id=1 WHERE id=2 RETURNING id')).rows.length,0);
  assert.equal((await db.query('DELETE FROM trade_items WHERE id=2 RETURNING id')).rows.length,0);
  await assert.rejects(db.exec('UPDATE trade_items SET post_id=2 WHERE id=1'));
 }));
 await check('recipient may read-mark but cannot rewrite sender/content/creation time',async()=>as('authenticated',other,async()=>{
  await db.exec('UPDATE messages SET is_read=true,read_at=now() WHERE id=1');
  for(const sql of ["UPDATE messages SET content='forged' WHERE id=1",`UPDATE messages SET sender_id='${other}' WHERE id=1`,"UPDATE messages SET created_at=now() WHERE id=1"])await assert.rejects(db.exec(sql));
 }));
 await check('sender may edit text but never refresh event age or identities',async()=>as('authenticated',owner,async()=>{
  await db.exec("UPDATE messages SET content='edited' WHERE id=1");
  await assert.rejects(db.exec('UPDATE messages SET created_at=now() WHERE id=1'));
  await db.exec(`INSERT INTO messages(id,sender_id,receiver_id,content,created_at) VALUES(2,'${owner}','${other}','new','2000-01-01')`);
  assert.ok(Date.parse((await db.query('SELECT created_at FROM messages WHERE id=2')).rows[0].created_at)>Date.now()-10000);
 }));
 await check('missing identity is never service permission',async()=>as('authenticated',null,async()=>{
  await assert.rejects(db.exec(`INSERT INTO messages(id,sender_id,receiver_id)VALUES(3,'${owner}','${other}')`));
 }));
 await check('subscription enumeration is own-only, anon empty, admin count aggregate only',async()=>{
  await as('authenticated',owner,async()=>{assert.equal((await db.query('SELECT * FROM push_subscriptions')).rows.length,1);await assert.rejects(db.query('SELECT get_push_subscriber_count()'));});
  await as('anon',null,async()=>assert.equal((await db.query('SELECT * FROM push_subscriptions')).rows.length,0));
  await db.exec(`INSERT INTO admin_roles VALUES('${owner}','admin')`);
  await as('authenticated',owner,async()=>{assert.equal(Number((await db.query('SELECT get_push_subscriber_count() AS n')).rows[0].n),2);await db.query('UPDATE users SET verified=true WHERE id=$1',[owner]);});
 });
 await check('browser roles cannot call quota/table internals',async()=>{
  for(const role of ['anon','authenticated'])await as(role,owner,async()=>{
   // Unrelated table-level privilege cleanup is deliberately outside this release.
   await assert.rejects(db.query("SELECT reserve_security_action('u','s','event',2,60,600)"));
   await assert.rejects(db.query('SELECT * FROM security_runtime.action_events'));
  });
 });
 await check('durable reservations deduplicate and enforce caller quota',async()=>as('service_role',null,async()=>{
  const reserve=async(key)=>(await db.query("SELECT reserve_security_action('u','push-event',$1,2,60,600) AS r",[key])).rows[0].r;
  assert.equal((await reserve('event1')).allowed,true);
  assert.equal((await reserve('event1')).reason,'duplicate');
  assert.equal((await reserve('event2')).allowed,true);
  assert.equal((await reserve('event3')).reason,'rate_limit');
 }));
 await check('service DB maintenance stays authorized',async()=>as('service_role',null,async()=>{
  assert.equal((await db.query('SELECT * FROM push_subscriptions')).rows.length,2);
  await db.exec("UPDATE messages SET content='service maintenance' WHERE id=1");
 }));
 await check('real production welcome trigger retains DB-owner bypass',async()=>{
  await db.exec("CREATE OR REPLACE FUNCTION public.send_welcome_dm()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nDECLARE\n  admin_id UUID;\n  welcome_msg TEXT;\nBEGIN\n  -- super_admin \uacc4\uc815 \uc911 \uccab \ubc88\uc9f8\ub97c \ubc1c\uc2e0\uc790\ub85c \uc0ac\uc6a9\n  SELECT ar.user_id INTO admin_id\n  FROM admin_roles ar\n  WHERE ar.role = 'super_admin'\n  ORDER BY ar.created_at ASC\n  LIMIT 1;\n\n  -- super_admin\uc774 \uc5c6\uc73c\uba74 DM \uc0dd\ub7b5\n  IF admin_id IS NULL THEN\n    RETURN NEW;\n  END IF;\n\n  -- \uc790\uae30 \uc790\uc2e0\uc5d0\uac8c\ub294 \ubc1c\uc1a1\ud558\uc9c0 \uc54a\uc74c\n  IF admin_id = NEW.id THEN\n    RETURN NEW;\n  END IF;\n\n  welcome_msg := '\ucc38\uc678\uc774\uc57c\uae30\uc5d0 \uc624\uc2e0 \uac83\uc744 \ud658\uc601\ud569\ub2c8\ub2e4! \ud83c\udf48' || chr(10) || chr(10) ||\n    '\uc131\uc8fc\uad70 \ub18d\uc5c5\uc778\ub4e4\uc774 \ud568\uaed8 \ub9cc\ub4e4\uc5b4\uac00\ub294 \ucee4\ubba4\ub2c8\ud2f0\uc785\ub2c8\ub2e4.' || chr(10) ||\n    '\uc601\ub18d \uc815\ubcf4 \uacf5\uc720, \uc9c8\ubb38, \uc911\uace0\uac70\ub798 \ub4f1 \ud3b8\ud558\uac8c \uc774\uc6a9\ud574\uc8fc\uc138\uc694.' || chr(10) || chr(10) ||\n    '\uc990\uac70\uc6b4 \ucc38\uc678 \ub18d\uc0ac \ub418\uc2dc\uae38 \ubc14\ub78d\ub2c8\ub2e4!';\n\n  INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at, updated_at)\n  VALUES (admin_id, NEW.id, welcome_msg, false, NOW(), NOW());\n\n  RETURN NEW;\nEXCEPTION\n  WHEN OTHERS THEN\n    -- DM \ubc1c\uc1a1 \uc2e4\ud328\ud574\ub3c4 \ud68c\uc6d0\uac00\uc785\uc740 \uc815\uc0c1 \uc9c4\ud589\n    RETURN NEW;\nEND;\n$function$\n");
  await db.exec(`INSERT INTO admin_roles(user_id,role)VALUES('${other}','super_admin');ALTER SEQUENCE public.messages_id_seq RESTART WITH 100;CREATE TRIGGER actual_welcome AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.send_welcome_dm();`);
  const id='33333333-3333-4333-8333-333333333333';
  await as('authenticated',id,async()=>{await db.query('INSERT INTO users(id,name)VALUES($1,$2)',[id,'fixture new user']);});
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM messages WHERE receiver_id=$1 AND sender_id=$2',[id,other])).rows[0].n),1);
 });
 await check('exact postapply rollback check executes without persistent writes',async()=>{ const before=(await db.query('SELECT count(*) AS n FROM security_runtime.action_events')).rows[0].n;await db.exec(await readFile(new URL('../docs/security/approved-db-push-rollback-check.sql',import.meta.url),'utf8'));assert.equal((await db.query('SELECT count(*) AS n FROM security_runtime.action_events')).rows[0].n,before); });
 console.log(JSON.stringify({passed,engine:'in-memory PGlite',productionConnection:false}));
}finally{await db.close();}
