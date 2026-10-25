'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowRight,LockKeyhole,ShoppingBag} from 'lucide-react';
import {defaultCommerceSettings,deliveryCharge,type CommerceSettings} from './commerce-model';
import type {Order,Product} from './model';
export type CheckoutItem={product:string;quantity:number;size:string};
const money=(amount:number)=>'₹'+amount.toLocaleString('en-IN');
export default function Checkout({items,products,user,onSuccess}:{items:CheckoutItem[];products:Product[];user:{id:string;name:string;email:string;phone:string}|null;onSuccess:(order:Order,products:Product[])=>void}){
  const [settings,setSettings]=useState<CommerceSettings>(defaultCommerceSettings),[ready,setReady]=useState(false),[address,setAddress]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const addressEdited=useRef(false),checkoutId=useRef('');
  async function options(){const response=await fetch('/api/store-options');const body=await response.json() as {settings:CommerceSettings};if(!response.ok)throw Error('Unable to open checkout. Please try again.');setSettings(body.settings);setReady(true);}
  useEffect(()=>{void options().catch(error=>setError(error instanceof Error?error.message:'Please try again.'));if(user)fetch('/api/account').then(response=>response.json() as Promise<{address?:string}>).then(body=>{if(!addressEdited.current)setAddress(body.address||'');}).catch(()=>{});const saved=sessionStorage.getItem('aarini-checkout-id');checkoutId.current=saved||crypto.randomUUID();sessionStorage.setItem('aarini-checkout-id',checkoutId.current);},[user?.id]);
  const lines=items.map(item=>({item,product:products.find(product=>product.id===item.product&&!product.archived)}));
  const valid=lines.length>0&&lines.every(line=>line.product&&line.product.stock>=line.item.quantity);
  const subtotal=lines.reduce((sum,line)=>sum+(line.product?.price||0)*line.item.quantity,0),shipping=deliveryCharge(subtotal,settings),total=subtotal+shipping;
  if(!user)return <div className="checkout-content"><span className="eyebrow">YOUR NEXT FAVOURITE</span><h2>Make it yours.</h2><p>Sign in to continue to checkout.</p><a className="btn full" href="/login?next=checkout">Sign in to buy <ArrowRight size={16}/></a></div>;
  return <div className="checkout-content"><span className="eyebrow">{settings.storeName.toUpperCase()}</span><h2>Make it yours.</h2><p>Delivery for {user.name} · {user.phone}</p>
    <div className="checkout-items">{lines.map(({item,product})=><div className="checkout-item" key={item.product+item.size}><ShoppingBag size={18}/><div><strong>{product?.name||'Unavailable outfit'}</strong><small>Size {item.size} · Quantity {item.quantity}</small></div><span>{money((product?.price||0)*item.quantity)}</span></div>)}</div>
    {!valid&&<p className="error">An outfit is no longer available in this quantity. Please review your bag.</p>}
    {!settings.acceptOrders||!settings.codEnabled?<p className="info-box">Checkout is currently unavailable. Please try again later.</p>:<form onSubmit={async event=>{event.preventDefault();if(busy||!valid||!ready)return;const fields=new FormData(event.currentTarget);setBusy(true);setError('');try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,address,notes:fields.get('notes'),paymentMethod:'cod',checkoutId:checkoutId.current,expectedTotal:total})}),body=await response.json() as {order?:Order;products?:Product[];error?:string};if(!response.ok||!body.order){if(response.status===409)await options();throw Error(body.error||'Unable to place your order.');}onSuccess(body.order,body.products||products);}catch(error){setError(error instanceof Error?error.message:'Unable to place your order.');}finally{setBusy(false);}}}>
      <label>Delivery address<textarea name="address" autoComplete="street-address" maxLength={1000} required value={address} onChange={event=>{addressEdited.current=true;setAddress(event.target.value);}} placeholder="House, street, area and postal code"/></label>
      <label>Delivery notes <span className="fine">Optional</span><textarea name="notes" maxLength={500} placeholder="Any delivery instructions?"/></label>
      <div className="checkout-payment"><LockKeyhole size={17}/><div><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></div></div>
      <div className="checkout-totals"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Delivery</span><span>{shipping?money(shipping):'Free'}</span></div><div><strong>Total</strong><strong>{money(total)}</strong></div></div>
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="btn full" disabled={busy||!valid||!ready}>{busy?'Placing your order…':!ready?'Opening checkout…':'Place order'}<ArrowRight size={16}/></button>
    </form>}
  </div>;
}
