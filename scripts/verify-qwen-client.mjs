import {Client,handle_file} from '@gradio/client';
import {readFileSync,writeFileSync} from 'node:fs';
let client;
try{
  client=await Client.connect('Qwen/Qwen-Image-Edit-2511',{events:['data','status']});
  const call=client.submit('/infer',{images:[{image:handle_file(new Blob([readFileSync('.local/fashion-fixtures/printed-fabric.png')],{type:'image/png'})),caption:null}],prompt:'Create a single realistic Indian boat-neck short-sleeve blouse on a plain cream background using the colours and checked pattern of this fabric. No person. No text. This is a design concept.',seed:42,randomize_seed:false,true_guidance_scale:4,num_inference_steps:30,height:768,width:768,rewrite_prompt:false});
  const timer=setTimeout(()=>void call.cancel(),180000);
  try{for await(const event of call){if(event.type==='status')console.log(JSON.stringify({stage:event.stage,message:event.message?.replace(/https?:\/\/\S+/g,'[address]').slice(0,1000)}));if(event.type==='data'){const image=event.data?.[0]?.[0]?.image;if(image?.url){const response=await fetch(image.url,{signal:AbortSignal.timeout(20000)});console.log('Generated image retrieval:',response.status);if(response.ok)writeFileSync('.local/fashion-live/sdk-concept.png',Buffer.from(await response.arrayBuffer()));}else console.log('Unexpected output structure');}}}finally{clearTimeout(timer);}
}catch(error){console.log('Official client failed:',error.message?.replace(/https?:\/\/\S+/g,'[address]').slice(0,1000));}finally{client?.close();}
