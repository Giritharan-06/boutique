import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {fabricTrialEnabled,fabricTrialAccess} from '../../../lib/local/fabric-trial';
import FabricTrialStudio from '../../fabric-trial/studio';
import '../../fabric-trial/trial.css';

export const dynamic='force-dynamic';
export const metadata={title:'Fabric atelier trial — Aarini studio',robots:{index:false,follow:false}};
export default async function FabricTrialPage(){
  if(!fabricTrialEnabled())notFound();
  const request=new Request('https://aarini.internal/crm/fabric-trial',{headers:new Headers(await headers())});
  if(!await fabricTrialAccess(request))redirect('/crm/login');
  return <FabricTrialStudio/>;
}
