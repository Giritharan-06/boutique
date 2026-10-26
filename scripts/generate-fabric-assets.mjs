import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
const code=ts.transpileModule(readFileSync('app/fabric-trial/templates.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {blouseTemplates}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const root='public/fabric-trial';mkdirSync(root,{recursive:true});
for(const template of blouseTemplates){
  writeFileSync(`${root}/${template.id}-mask.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024" fill="none"><path d="${template.path}" fill="white"/></svg>\n`);
  writeFileSync(`${root}/${template.id}-thumb.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="230" viewBox="180 270 408 300"><rect x="180" y="270" width="408" height="300" rx="18" fill="#f5eade"/><path d="${template.path}" fill="#925168"/>${template.seams.map(path=>`<path d="${path}" fill="none" stroke="#e9cbb7" stroke-width="3"/>`).join('')}</svg>\n`);
}
const sample=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#bb435d"/><path d="M0 0h128v128H0Zm128 128h128v128H128Z" fill="#f2ca8c"/><path d="M0 64h256M0 192h256M64 0v256M192 0v256" stroke="#732b43" stroke-width="10"/><circle cx="64" cy="64" r="13" fill="#fcf1dd"/><circle cx="192" cy="192" r="13" fill="#fcf1dd"/></svg>`;
await sharp(Buffer.from(sample)).png().toFile(root+'/sample-fabric.png');
console.log('Created four transparent masks, four thumbnails and one synthetic sample fabric.');
