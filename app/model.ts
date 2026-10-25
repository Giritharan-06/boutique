export type Product={id:string;name:string;category:string;price:number;stock:number;panel:number;colour:string;fabric:string};
export type Customer={id:string;name:string;email:string;phone:string;notes:string};
export type Order={id:string;customer:string;email:string;address:string;items:{product:string;name:string;price:number;quantity:number;size:string}[];total:number;status:string;date:string};
export type Appointment={id:string;name:string;date:string;service:string;notes:string;status:string};
export type Shop={products:Product[];customers:Customer[];orders:Order[];appointments:Appointment[]};
export const statuses=['New','Confirmed','Tailoring','Shipped','Completed','Cancelled'];
export const initialShop:Shop={products:[{id:'rose',name:'Gulabi embroidered anarkali',category:'Celebrations',price:6490,stock:12,panel:0,colour:'#cb9990',fabric:'Embroidered georgette'},{id:'sage',name:'Sage garden kurta set',category:'Everyday',price:3890,stock:18,panel:1,colour:'#919b7d',fabric:'Soft silk blend'},{id:'wine',name:'Noor festive lehenga',category:'Festive',price:12490,stock:6,panel:2,colour:'#741f31',fabric:'Embellished silk blend'}],customers:[],orders:[],appointments:[]};
export function reduceShop(shop:Shop,a:any):Shop{
 const s=structuredClone(shop);
 const str=(v:any,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Please complete the required fields.');return v.trim();};
 const email=(v:any)=>{v=str(v);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('Enter a valid email.');return v;};
 if(a.type==='product'){
 const p=a.product;if(!Number.isSafeInteger(p.price)||p.price<1||p.price>1000000||!Number.isSafeInteger(p.stock)||p.stock<0||p.stock>10000)throw Error('Enter a valid price and stock quantity.');
 if(!['Everyday','Festive','Celebrations'].includes(p.category)||![0,1,2].includes(p.panel))throw Error('Choose a valid collection.');
 const item:Product={id:p.id?str(p.id):crypto.randomUUID(),name:str(p.name,100),category:p.category,price:p.price,stock:p.stock,panel:p.panel,colour:['#cb9990','#919b7d','#741f31'][p.panel],fabric:str(p.fabric,100)};
 const i=s.products.findIndex(x=>x.id===item.id);if(i<0)s.products.push(item);else s.products[i]=item;
 }else if(a.type==='customer')s.customers.unshift({id:crypto.randomUUID(),name:str(a.name,100),email:email(a.email),phone:str(a.phone,30),notes:typeof a.notes==='string'?a.notes.slice(0,2000):''});
 else if(a.type==='appointment'){
 const date=str(a.date,30);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||date<new Date().toISOString().slice(0,10))throw Error('Choose today or a future date.');
 s.appointments.unshift({id:crypto.randomUUID(),name:str(a.name,100),date,service:str(a.service,100),notes:typeof a.notes==='string'?a.notes.slice(0,2000):'',status:'Requested'});
 }else if(a.type==='appointmentStatus'){
 const x=s.appointments.find(x=>x.id===a.id);if(!x||!['Requested','Booked','Completed'].includes(a.status))throw Error('Invalid appointment.');x.status=a.status;
 }else if(a.type==='order'){
 if(!Array.isArray(a.items)||!a.items.length||a.items.length>30)throw Error('Your bag is empty or too large.');
 const items=a.items.map((i:any)=>{const p=s.products.find(p=>p.id===i.product);if(!p||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>10||!['S','M','L','XL'].includes(i.size))throw Error('Invalid bag item.');if(p.stock<i.quantity)throw Error(p.name+' has insufficient stock.');p.stock-=i.quantity;return {product:p.id,name:p.name,price:p.price,quantity:i.quantity,size:i.size};});
 const customer=str(a.name,100),mail=email(a.email);
 s.orders.unshift({id:'AR-'+crypto.randomUUID().slice(0,8).toUpperCase(),customer,email:mail,address:str(a.address,1000),items,total:items.reduce((n:number,i:any)=>n+i.price*i.quantity,0),date:new Date().toISOString(),status:'New'});
 if(!s.customers.some(x=>x.email===mail))s.customers.unshift({id:crypto.randomUUID(),name:customer,email:mail,phone:typeof a.phone==='string'?a.phone.slice(0,30):'',notes:''});
 }else if(a.type==='status'){
 const o=s.orders.find(x=>x.id===a.id);if(!o||!statuses.includes(a.status))throw Error('Invalid order status.');if(o.status==='Cancelled'&&a.status!=='Cancelled')throw Error('Cancelled orders cannot be reopened.');
 if(a.status==='Cancelled'&&o.status!=='Cancelled')for(const i of o.items){const p=s.products.find(p=>p.id===i.product);if(p)p.stock+=i.quantity;}o.status=a.status;
 }else throw Error('Unknown action.');return s;
}
