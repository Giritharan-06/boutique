import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {studioEnabled,studioAdmin} from '../../../lib/fashion-studio/access';
import FashionStudio from '../../fashion-studio/studio';
import '../../fashion-studio/studio.css';
export const dynamic='force-dynamic';
export const metadata={title:'Fashion Studio — Aarini Atelier',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page(){
  if(!studioEnabled())notFound();
  const request=new Request('https://aarini.internal/crm/fashion-studio',{headers:new Headers(await headers())});
  try{await studioAdmin(request);}catch{redirect('/crm/login');}
  return <FashionStudio/>;
}
