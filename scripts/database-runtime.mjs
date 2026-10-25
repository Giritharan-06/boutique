import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function databaseRuntime({loadEnvironment=true}={}){
  if(loadEnvironment){try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const root=resolve('.local/database-runtime');mkdirSync(root,{recursive:true});
  const entries=[['app/model.ts','model'],['app/commerce-model.ts','commerce-model'],['lib/local/database.ts','database'],['lib/local/auth.ts','auth'],['lib/local/store.ts','store'],['lib/local/commerce.ts','commerce']];
  for(const [file,name] of entries){let source=readFileSync(file,'utf8');source=source.replace(/(['"])(?:\.\.\/\.\.\/app\/|\.\/)(model|commerce-model|database|auth|store|commerce)\1/g,(_,quote,module)=>quote+'./'+module+'.mjs'+quote);writeFileSync(join(root,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
  return async name=>import(pathToFileURL(join(root,name+'.mjs')).href);
}
