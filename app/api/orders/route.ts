import {getAuthUser} from '../../../lib/local/auth';
import {readShop,updateShop} from '../../../lib/local/store';
import {localRequest,boundedJson} from '../../../lib/local/security';
import {readCommerceSettings} from '../../../lib/local/commerce';
import {deliveryCharge,ownsOrder} from '../../commerce-model';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){if(!localRequest(req))return json({error:'Local access only.'},403);const user=getAuthUser(req,'customer');if(!user)return json({error:'Please sign in to view your orders.'},401);return json({orders:readShop().shop.orders.filter(order=>ownsOrder(order,user)).sort((a,b)=>b.date.localeCompare(a.date)),canCancel:readCommerceSettings().settings.customerCancellation});}
export async function POST(req:Request){
  if(!localRequest(req,true))return json({error:'Invalid request.'},403);
  const user=getAuthUser(req,'customer');if(!user)return json({error:'Please sign in to continue.'},401);
  try{
    const body=await boundedJson(req,25000),current=readShop(),settings=readCommerceSettings().settings;
    if(body.action==='cancel'){
      const order=current.shop.orders.find(order=>order.id===body.id&&ownsOrder(order,user));if(!order)return json({error:'Order not found.'},404);
      if(order.status==='Cancelled')return json({order});
      if(!settings.customerCancellation||!['New','Confirmed'].includes(order.status)||order.paymentStatus==='Paid')throw Error('Please contact the boutique about cancelling this order.');
      const result=updateShop(current.revision,{type:'status',id:order.id,status:'Cancelled'});if(!result)return json({error:'The order changed. Refresh and try again.'},409);return json({order:result.shop.orders.find(item=>item.id===order.id)});
    }
    const checkoutId=typeof body.checkoutId==='string'&&/^[a-f0-9-]{36}$/i.test(body.checkoutId)?body.checkoutId:randomUUID();
    const existing=current.shop.orders.find(order=>order.accountId===user.id&&order.checkoutId===checkoutId);if(existing)return json({order:existing,products:current.shop.products.filter(product=>!product.archived)});
    if(!settings.acceptOrders||!settings.codEnabled)throw Error('Checkout is currently unavailable. Please try again later.');
    if(body.paymentMethod&&body.paymentMethod!=='cod')throw Error('Choose an available payment method.');
    if(typeof body.address!=='string'||!body.address.trim())throw Error('Enter a delivery address.');
    if(!Array.isArray(body.items)||!body.items.length||body.items.length>30)throw Error('Your bag is empty or too large.');
    const subtotal=body.items.reduce((sum:number,item:any)=>{const product=current.shop.products.find(product=>product.id===item.product&&!product.archived);if(!product||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10)throw Error('An outfit is unavailable. Review your bag.');return sum+product.price*item.quantity;},0);
    const shipping=deliveryCharge(subtotal,settings);if(body.expectedTotal!==undefined&&body.expectedTotal!==subtotal+shipping)return json({error:'Your order total changed. Please review checkout and try again.'},409);
    const result=updateShop(current.revision,{type:'order',items:body.items,name:user.name,email:user.email,phone:user.phone,accountId:user.id,checkoutId,address:body.address,notes:body.notes,shipping});
    if(!result){const latest=readShop();const duplicate=latest.shop.orders.find(order=>order.accountId===user.id&&order.checkoutId===checkoutId);if(duplicate)return json({order:duplicate,products:latest.shop.products.filter(product=>!product.archived)});return json({error:'The collection changed. Review your bag and try again.'},409);}
    return json({order:result.shop.orders[0],products:result.shop.products.filter(product=>!product.archived)});
  }catch(error){return json({error:error instanceof Error?error.message:'Unable to place your order.'},400);}
}
