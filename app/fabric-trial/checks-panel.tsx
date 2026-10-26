'use client';
import {useState} from 'react';
import {runFabricBrowserChecks,type BrowserCheck} from './browser-checks';
export default function FabricChecksPanel(){
  const [results,setResults]=useState<BrowserCheck[]>([]),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  return <div className="fabric-panel"><h1>Fabric preview browser checks</h1><p>Runs real canvas and PNG checks using synthetic swatches. No customer images or AI services are used.</p><button className="btn" disabled={busy} onClick={async()=>{setResults([]);setError('');setDone(false);setBusy(true);try{await runFabricBrowserChecks(result=>setResults(current=>[...current,result]));setDone(true);}catch(error){setError(error instanceof Error?error.message:'Browser checks failed.');}finally{setBusy(false);}}}>{busy?'Checking…':'Run browser checks'}</button><p role="status">{done?`${results.filter(item=>item.passed).length}/${results.length} browser checks passed`:busy?'Running real canvas checks…':'Ready to check this browser.'}</p>{error&&<p role="alert" className="error">{error}</p>}<ol>{results.map(result=><li key={result.name} style={{margin:'18px 0',lineHeight:1.6}}><strong>{result.passed?'PASS':'FAIL'} · {result.name}</strong><p>{result.detail}</p></li>)}</ol><a className="text-link" href="/crm/fabric-trial">Return to fabric studio</a></div>;
}
