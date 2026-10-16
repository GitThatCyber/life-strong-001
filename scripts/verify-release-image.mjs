import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../',import.meta.url).pathname;
const tag = 'life-strong-api:release-prep';
const suffix = `${process.pid}-${randomBytes(3).toString('hex')}`;
const network = `life-strong-test-${suffix}`,db = `life-strong-db-${suffix}`,api = `life-strong-api-${suffix}`;
const temp = mkdtempSync(join(tmpdir(),'life-strong-release-'));
const adminPassword = randomBytes(32).toString('hex'),appPassword = randomBytes(32).toString('hex');
const ownerPassword = randomBytes(32).toString('hex');
let madeNetwork = false,madeDb = false,madeApi = false;
function run(args,input) {
  const r = spawnSync('docker',args,{ cwd: root,encoding: 'utf8',input,timeout: 240000,maxBuffer: 4*1024*1024 });
  if (r.status !== 0) throw new Error(`Docker step failed: ${args.slice(0,2).join(' ')}\n${r.stderr ?? r.error?.message ?? ''}`);
  return r.stdout.trim();
}
const adminUrl = `postgres://lifestrong_admin:${adminPassword}@${db}:5432/lifestrong`;
const appUrl = `postgres://lifestrong_app:${appPassword}@${db}:5432/lifestrong`;
try {
  console.log('Building compiled API image…');run(['build','-f','backend/Dockerfile','-t',tag,'.']);
  run(['network','create',network]);madeNetwork = true;
  run(['run','-d','--name',db,'--network',network,'--tmpfs','/var/lib/postgresql/data',
    '-e','POSTGRES_USER=lifestrong_admin','-e',`POSTGRES_PASSWORD=${adminPassword}`,'-e','POSTGRES_DB=lifestrong','-e',`DB_APP_PASSWORD=${appPassword}`,
    '-v',`${root}deployment/init-roles.sh:/docker-entrypoint-initdb.d/010-roles.sh:ro`,'postgres:17-alpine']);madeDb = true;
  let healthy = false;
  for (let i=0;i<60;i++) {
    const probe = spawnSync('docker',['exec',db,'pg_isready','-h','127.0.0.1','-U','lifestrong_admin','-d','lifestrong'],{ encoding: 'utf8' });
    if (probe.status === 0) { healthy = true;break; }
    await new Promise(resolve => setTimeout(resolve,500));
  }
  if (!healthy) throw new Error('Temporary database did not become ready');
  // The entrypoint's temporary server can briefly answer before initialization ends.
  for (let i=0;i<60;i++) {
    const probe = spawnSync('docker',['exec',db,'psql','-U','lifestrong_admin','-d','lifestrong','-tAc',"SELECT 1 FROM pg_roles WHERE rolname='lifestrong_app'"],{ encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === '1') break;
    if (i===59) throw new Error('Runtime database role was not initialized');
    await new Promise(resolve => setTimeout(resolve,500));
  }
  const tools = ['run','--rm','--network',network,'-e',`DATABASE_URL=${adminUrl}`];
  run([...tools,tag,'npm','run','migrate:built']);run([...tools,tag,'npm','run','seed:built']);
  run(['exec','-i',db,'psql','-U','lifestrong_admin','-d','lifestrong','-v','ON_ERROR_STOP=1'],readFileSync(join(root,'deployment/runtime-grants.sql'),'utf8'));
  run([...tools,'-e','OWNER_EMAIL=release-test@example.invalid','-e',`OWNER_PASSWORD=${ownerPassword}`,tag,'npm','run','owner:setup:built']);
  run(['run','-d','--name',api,'--network',network,'--read-only','--tmpfs','/tmp','--cap-drop','ALL','--security-opt','no-new-privileges:true',
    '-e','NODE_ENV=production','-e','AUTH_MODE=owner','-e','PUBLIC_ORIGIN=https://api.example.invalid','-e',`DATABASE_URL=${appUrl}`,tag]);madeApi = true;
  const check = `
    import assert from 'node:assert/strict';import pg from 'pg';
    assert.notEqual(process.getuid(),0);
    let ready=false;for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:3000/api/v1/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
    const base='http://127.0.0.1:3000/api/v1';
    const headers={'Content-Type':'application/json','X-Forwarded-Proto':'https'};
    assert.equal((await fetch(base+'/exercises',{headers})).status,401);
    assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'release-test@example.invalid',password:process.env.TEST_OWNER_PASSWORD})})).status,400);
    const login=await fetch(base+'/auth/login',{method:'POST',headers,body:JSON.stringify({email:'release-test@example.invalid',password:process.env.TEST_OWNER_PASSWORD})});assert.equal(login.status,200);const {token}=await login.json();
    headers.Authorization='Bearer '+token;
    const exercises=await fetch(base+'/exercises',{headers});assert.equal(exercises.status,200);assert.equal((await exercises.json()).length,4);
    const connection=new pg.Pool({connectionString:process.env.DATABASE_URL});
    const role=(await connection.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(role,{rolsuper:false,rolcreatedb:false,rolcreaterole:false});
    await assert.rejects(connection.query(\"INSERT INTO schema_migrations(filename) VALUES('forbidden')\"));
    await assert.rejects(connection.query(\"UPDATE app_owner SET id=gen_random_uuid()\"));
    assert.equal((await fetch(base+'/account/export',{headers})).status,200);
    assert.equal((await fetch(base+'/account',{method:'DELETE',headers,body:JSON.stringify({confirmation:'DELETE MY ACCOUNT'})})).status,200);
    assert.equal((await connection.query('SELECT count(*)::int AS n FROM exercises')).rows[0].n,0);
    assert.equal((await fetch(base+'/sessions',{headers})).status,401);await connection.end();
    console.log('PASS: hardened container, runtime role, owner HTTPS login, export, deletion and revocation');
  `;
  console.log(run(['exec','-e',`TEST_OWNER_PASSWORD=${ownerPassword}`,api,'node','--input-type=module','-e',check]));
  const envFile = join(temp,'env');writeFileSync(envFile,`DB_ADMIN_PASSWORD=${adminPassword}\nDB_APP_PASSWORD=${appPassword}\nPUBLIC_HOST=api.example.invalid\n`,{ mode: 0o600 });
  run(['compose','--env-file',envFile,'-f','deployment/compose.yml','config','--quiet']);
  run(['run','--rm','-e','PUBLIC_HOST=api.example.invalid','-v',`${root}deployment/Caddyfile:/etc/caddy/Caddyfile:ro`,'caddy:2-alpine','caddy','validate','--config','/etc/caddy/Caddyfile']);
  console.log('PASS: deployment Compose and HTTPS proxy configuration validate; no host ports or cloud resources were created');
} finally {
  if (madeApi) spawnSync('docker',['rm','-f',api],{ encoding: 'utf8' });
  if (madeDb) spawnSync('docker',['rm','-f',db],{ encoding: 'utf8' });
  if (madeNetwork) spawnSync('docker',['network','rm',network],{ encoding: 'utf8' });
  rmSync(temp,{ recursive: true,force: true });
}
