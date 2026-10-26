import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {fabricTrialEnabled,fabricTrialAccess} from '../../../../lib/local/fabric-trial';
import FabricChecksPanel from '../../../fabric-trial/checks-panel';
import '../../../fabric-trial/trial.css';
export const dynamic='force-dynamic';
export const metadata={title:'Fabric trial checks — Aarini studio',robots:{index:false,follow:false}};
export default async function FabricChecksPage(){
  if(!fabricTrialEnabled())notFound();
  if(!await fabricTrialAccess(new Request('https://aarini.internal/crm/fabric-trial/checks',{headers:new Headers(await headers())})))redirect('/crm/login');
  return <main className="fabric-trial"><div className="fabric-trial-shell"><FabricChecksPanel/></div></main>;
}
