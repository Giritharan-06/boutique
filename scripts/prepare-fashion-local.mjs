import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
let env=readFileSync('.env.local','utf8');
for(const [key,value] of Object.entries({AI_FASHION_STUDIO_ENABLED:'true',AI_STUDIO_ALLOW_DEMOS:'true',AI_STUDIO_DAILY_LIMIT:'24'})){const rule=new RegExp('^'+key+'=.*$','m');env=rule.test(env)?env.replace(rule,key+'='+value):env+'\n'+key+'='+value;}
if(!/^AI_STUDIO_IMAGE_KEY=[a-f0-9]{64}$/im.test(env))env+='\nAI_STUDIO_IMAGE_KEY='+randomBytes(32).toString('hex')+'\n';
writeFileSync('.env.local',env);mkdirSync('.local/fashion-fixtures',{recursive:true});
await sharp('C:/Users/Girit/.codex/generated_images/01a171de-4ecd-77a1-a85c-cfd399bf6d6f/exec-422245c8-1d4d-4cbb-b738-6bb99e3f6cc0.png').resize({height:1200}).jpeg({quality:90}).toFile('.local/fashion-fixtures/synthetic-person.jpg');
const board=sharp('public/fashion-studio/style-board.png'),meta=await board.metadata();
await board.extract({left:0,top:0,width:Math.floor(meta.width/4),height:Math.floor(meta.height/2)}).png().toFile('.local/fashion-fixtures/ai-blouse-reference.png');
await sharp('public/fabric-trial/sample-fabric.png').png().toFile('.local/fashion-fixtures/printed-fabric.png');
await sharp({create:{width:400,height:400,channels:3,background:'#9a3850'}}).png().toFile('.local/fashion-fixtures/plain-fabric.png');
await sharp('public/fashion-studio/style-board.png').webp({quality:88}).toFile('public/fashion-studio/style-board.webp');
for(const file of ['app/fashion-studio/studio.tsx','app/fashion-studio/studio.css'])writeFileSync(file,readFileSync(file,'utf8').replaceAll('/fashion-studio/style-board.png','/fashion-studio/style-board.webp'));
console.log('Local admin studio enabled; image key kept in ignored .env.local. Synthetic fixtures prepared.');
