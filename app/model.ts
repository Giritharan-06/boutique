export type Product={id:string;name:string;category:string;price:number;stock:number;panel:number;colour:string;fabric:string;imageSet:string;imageIndex:number;description:string;craft:string;includes:string;fit:string;care:string;images:string[];archived?:boolean};
export type Customer={id:string;name:string;email:string;phone:string;notes:string;previousEmails?:string[]};
export type Order={id:string;customer:string;email:string;address:string;items:{product:string;name:string;price:number;quantity:number;size:string}[];total:number;status:string;date:string;accountId?:string;checkoutId?:string;shipping?:number;paymentMethod?:'cod';paymentStatus?:'Unpaid'|'Paid'|'Refunded';notes?:string};
export type Appointment={id:string;name:string;date:string;service:string;notes:string;status:string};
export type Shop={products:Product[];customers:Customer[];orders:Order[];appointments:Appointment[]};
export const statuses=['New','Confirmed','Tailoring','Shipped','Completed','Cancelled'];
export const collections=['Sarees','Chudithar','Lehengas & Occasionwear','Contemporary'];
const imageSets:Record<string,string>={'Sarees':'sarees','Chudithar':'chudithar','Lehengas & Occasionwear':'occasionwear','Contemporary':'contemporary'};
type Row=[string,string,number,string,string,number,string,string];
function group(category:string,imageSet:string,fit:string,care:string,includes:string,rows:Row[]):Product[]{return rows.map(([id,name,price,fabric,colour,imageIndex,craft,description],index)=>({id,name,category,price,stock:index===0?12:index===1?18:6+index,panel:index%3,colour,fabric,imageSet,imageIndex,craft,description,includes,fit,care,images:[]}));}
const products:Product[]=[
...group('Sarees','sarees','Classic six-yard drape; blouse is unstitched unless noted.','Dry clean recommended. Store folded in a breathable cotton cover.','One saree with attached or matching blouse fabric.',[
['sari-banara-rose','Gulabi Banarasi silk saree',6890,'Banarasi silk · zari border','#b95366',0,'Woven zari border','A rose-toned heirloom drape with a softly luminous finish for celebrations.'],
['sari-indigo-handloom','Indigo handloom cotton saree',4290,'Handloom cotton silk','#344b70',1,'Handwoven motifs','A breathable handloom drape with quiet indigo motifs for long, lovely days.'],
['sari-ivory-bloom','Ivory garden organza saree',5890,'Organza · floral threadwork','#e2d5c4',2,'Floral thread embroidery','Airy ivory organza scattered with delicate blooms and a fine finished edge.'],
['sari-emerald-chanderi','Emerald Chanderi saree',6190,'Chanderi silk-cotton','#326451',3,'Subtle woven zari','Light-catching Chanderi in a deep garden green, finished with a fine gold edge.'],
['sari-kanjeevaram','Sunlit Kanjivaram silk saree',11990,'Pure silk · contrast zari','#c47a37',0,'Temple-inspired zari border','A rich silk statement with a traditional contrast border and graceful drape.'],
['sari-tussar','Mulberry tussar saree',7490,'Tussar silk','#7f5363',1,'Hand-painted buti detailing','Naturally textured tussar with hand-finished buti details and a fluid fall.'],
['sari-lilac-georgette','Lilac evening georgette saree',5290,'Georgette · sequin highlights','#a88cae',2,'Hand-sewn sequin edge','A softly draped evening saree with subtle shimmer, made for celebration dinners.'],
['sari-coral-print','Coral block-print cotton saree',3190,'Cotton · hand block print','#d77d67',3,'Traditional hand block print','Easy, airy cotton with a coral botanical print for everyday dressing.'],
['sari-midnight-rawsilk','Midnight raw silk saree',8990,'Raw silk','#343748',0,'Woven antique-gold border','A textured midnight drape paired with an understated antique-gold border.'],
['sari-pista-linen','Pista linen festive saree',3690,'Linen blend · zari selvedge','#b2ba91',1,'Fine zari selvedge','Crisp, breathable linen softened with a glint of zari along the selvedge.']]),
...group('Chudithar','chudithar','Easy straight fit with a relaxed, flattering silhouette.','Gentle hand wash separately in cool water; dry in shade.','Three-piece set: kurta, bottoms and matching dupatta.',[
['sage','Sage garden kurta set',3890,'Soft silk blend','#919b7d',0,'Fine floral thread embroidery','A soft sage three-piece set with delicate floral work and an easy festive feel.'],
['chudi-blush-blockprint','Blush hand-block chudithar',2790,'Cotton voile','#d59aa4',1,'Hand-block printed motifs','Lightweight cotton with a small-scale block print and coordinating dupatta.'],
['chudi-teal-embroidered','Teal embroidered chudithar',4490,'Silk-cotton blend','#267277',2,'Tonal neckline embroidery','A deep teal set with considered neckline embroidery and a graceful dupatta.'],
['chudi-indigo-print','Indigo garden-print chudithar',3290,'Cambric cotton','#415b78',3,'Botanical block print','An indigo botanical print in breathable cotton, made for all-day comfort.'],
['chudi-mustard-chanderi','Mustard Chanderi chudithar',5290,'Chanderi silk-cotton','#c59232',0,'Fine zari woven accents','A sunny Chanderi set with delicate zari accents for smaller celebrations.'],
['chudi-plum-anarkali','Plum anarkali chudithar',4890,'Viscose georgette','#75445f',1,'Threadwork yoke','An easy-flare anarkali with a richly worked yoke and soft matching dupatta.'],
['chudi-ivory-chikankari','Ivory chikankari chudithar',5990,'Cotton voile','#e7dfd0',2,'Hand-inspired chikankari embroidery','A graceful ivory set with chikankari-inspired stitching and a light dupatta.'],
['chudi-mint-straight','Mint straight-cut set',3590,'Cotton-linen blend','#a9c2b3',3,'Fine pintuck front','A fresh mint straight-cut silhouette with breathable texture and fine pintucks.'],
['chudi-rust-ajrakh','Rust Ajrakh chudithar',3790,'Handloom cotton','#a65e45',0,'Ajrakh-inspired block print','Warm rust cotton with a traditional geometric print and coordinating scarf.'],
['chudi-navy-velvet','Navy velvet occasion set',6590,'Velvet kurta · silk bottoms','#303b5c',1,'Antique-gold hand embellishment','A plush navy set touched with antique-gold detail for evening gatherings.']]),
...group('Lehengas & Occasionwear','occasionwear','Structured at the waist with a flowing, occasion-ready skirt.','Professional dry clean only. Keep embroidery flat and away from moisture.','Embroidered blouse, lehenga skirt and matching dupatta.',[
['rose','Gulabi embroidered anarkali',6490,'Embroidered georgette','#cb9990',0,'All-over thread embroidery','A rose-hued occasion silhouette with delicate embroidery and a soft, sweeping drape.'],
['wine','Noor festive lehenga',12490,'Embellished silk blend','#741f31',1,'Antique-gold hand embellishment','A jewel-toned festive set with detailed hand embellishment and graceful volume.'],
['lehenga-rose-gold','Rose-gold celebration lehenga',14990,'Silk organza','#c89a8e',2,'Dense zari and sequin work','A softly luminous rose-gold lehenga with a finely worked blouse and light dupatta.'],
['lehenga-midnight-blue','Midnight blue mirror-work lehenga',16990,'Raw silk','#243c66',3,'Hand-set mirror work','A dramatic midnight blue skirt with hand-set mirrors and a richly detailed border.'],
['lehenga-champagne-floral','Champagne floral lehenga',13990,'Embroidered organza','#d9ccb5',0,'Three-dimensional floral embroidery','Soft champagne organza with dimensional blossoms for a romantic occasion look.'],
['lehenga-emerald-velvet','Emerald velvet heirloom lehenga',21990,'Velvet · silk lining','#315342',1,'Gold thread heritage motifs','Velvet in a deep emerald tone, detailed with heritage-inspired gold threadwork.'],
['lehenga-lilac-mirror','Lilac mirror-work sharara set',8990,'Georgette · satin lining','#a99ac4',2,'Mirror-work neckline','A lighter occasion option with a mirror-work neckline and a flowing sharara.'],
['lehenga-coral-gota','Coral gota patti anarkali',7690,'Silk cotton','#d77c6c',3,'Gota patti trim','Coral silk cotton shaped into an elegant anarkali with hand-finished gota trim.'],
['lehenga-ivory-pearl','Ivory pearl-work gown',11990,'Tulle · satin lining','#ded7cd',0,'Hand-sewn pearl detailing','A fluid ivory gown accented with hand-sewn pearls and a softly layered skirt.'],
['lehenga-teal-brocade','Teal brocade skirt set',15990,'Silk brocade','#287579',1,'Woven brocade with zari edge','A sculpted teal brocade set with a subtle zari edge and a refined finish.']]),
...group('Contemporary','contemporary','Relaxed modern fit; consult the size guide for a tailored feel.','Wash according to the garment label; turn embroidered pieces inside out.','Matching top and bottom as described in the product details.',[
['contemporary-floral-maxi','Meadow floral cotton maxi',4290,'Cotton voile','#d7bc99',0,'Woodblock-inspired floral print','An airy floral maxi with a softly gathered waist and a relaxed, sweeping hem.'],
['contemporary-rose-coord','Rose garden co-ord set',3890,'Cotton-linen blend','#b98183',1,'Botanical screen print','A rose-toned long tunic and wide-leg trouser set for an effortless weekday look.'],
['contemporary-olive-gown','Olive embroidered evening gown',8990,'Chiffon · crepe lining','#64714e',2,'Fine tonal threadwork','An olive evening gown with thoughtful threadwork and a fluid, flattering fall.'],
['contemporary-ivory-linen','Ivory linen shirt co-ord',4690,'European linen blend','#e7e0d3',3,'Mother-of-pearl buttons','A light linen-blend shirt and relaxed trouser set, finished with natural buttons.'],
['contemporary-teal-midi','Teal pleated midi dress',5190,'Viscose crepe','#43857d',0,'Knife-pleat skirt','A clean-lined midi dress with fine pleating and an easy movement through the skirt.'],
['contemporary-indigo-tunic','Indigo longline tunic set',3490,'Handloom cotton','#3c4e6d',1,'Handwoven dobby texture','A longline indigo tunic with a quiet handwoven texture and matching trousers.'],
['contemporary-sunlit-wrap','Sunlit wrap dress',3990,'Printed rayon','#cb9b56',2,'Artisan floral print','An easy wrap shape in a warm floral print, finished with a self-tie waist.'],
['contemporary-sage-jumpsuit','Sage tailored jumpsuit',5790,'Cotton twill','#9eaa8a',3,'Soft tailoring and side pockets','Softly tailored in sage with an adjustable waist and useful side pockets.'],
['contemporary-plum-kaftan','Plum occasion kaftan',6290,'Silk crepe','#744f68',0,'Beaded neckline','A relaxed plum silk-crepe kaftan with a hand-beaded neckline for evenings out.'],
['contemporary-sand-shirtdress','Sand cotton shirt dress',3290,'Textured cotton','#c4ae92',1,'Covered placket and belt','A crisp cotton shirt dress with a removable belt and an easy, versatile shape.']])
];
export const initialShop:Shop={products,customers:[],orders:[],appointments:[]};
export function reduceShop(shop:Shop,a:any):Shop{
 const s=structuredClone(shop);
 const str=(v:any,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Please complete the required fields.');return v.trim();};
 const optional=(v:any,fallback:string,max=500)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):fallback;
 const email=(v:any)=>{v=str(v);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error('Enter a valid email.');return v;};
 if(a.type==='product'){
 const p=a.product;if(!Number.isSafeInteger(p.price)||p.price<1||p.price>1000000||!Number.isSafeInteger(p.stock)||p.stock<0||p.stock>10000)throw Error('Enter a valid price and stock quantity.');
 if(!collections.includes(p.category)||![0,1,2].includes(p.panel))throw Error('Choose a valid collection.');
 const set=imageSets[p.category];
 const old=s.products.find(x=>x.id===p.id);if(p.id&&!old)throw Error('This product no longer exists.');const colour=optional(p.colour,old?.colour||['#b95366','#344b70','#741f31'][p.panel]);if(!/^#[a-f0-9]{6}$/i.test(colour))throw Error('Choose a valid product colour.');const images=Array.isArray(p.images)?p.images.filter((url:any)=>typeof url==='string'&&/^\/api\/product-images\/[a-f0-9-]+$/.test(url)).slice(0,4):old?.images||[];const item:Product={id:p.id?str(p.id):crypto.randomUUID(),name:str(p.name,100),category:p.category,price:p.price,stock:p.stock,panel:p.panel,colour,fabric:str(p.fabric,100),imageSet:set,imageIndex:Number.isInteger(p.imageIndex)?Math.max(0,Math.min(3,p.imageIndex)):old?.imageIndex||0,description:optional(p.description,'A thoughtfully made piece for your everyday wardrobe.'),craft:optional(p.craft,'Carefully finished details.'),includes:optional(p.includes,'One garment as pictured.'),fit:optional(p.fit,'Please consult the size guide for your best fit.'),care:optional(p.care,'Follow the care label; handle delicate details with care.'),images,archived:old?.archived||false};
 const i=s.products.findIndex(x=>x.id===item.id);if(i<0)s.products.push(item);else s.products[i]=item;
 }else if(a.type==='productArchive'){
 const product=s.products.find(p=>p.id===a.id);if(!product||typeof a.archived!=='boolean')throw Error('Choose a valid product.');product.archived=a.archived;
 }else if(a.type==='stock'){
 const product=s.products.find(p=>p.id===a.id);if(!product)throw Error('Choose a valid product.');if(!Number.isSafeInteger(a.stock)||a.stock<0||a.stock>10000)throw Error('Stock must be a whole number between 0 and 10,000.');product.stock=a.stock;
 }else if(a.type==='customer'){
 const old=a.id?s.customers.find(c=>c.id===a.id):undefined;if(a.id&&!old)throw Error('This customer no longer exists.');const mail=email(a.email).toLowerCase();if(s.customers.some(c=>c.id!==old?.id&&c.email.toLowerCase()===mail))throw Error('A customer already uses this email. Edit their existing profile.');const previousEmails=old&&old.email.toLowerCase()!==mail?[...new Set([...(old.previousEmails||[]),old.email.toLowerCase()])]:old?.previousEmails||[];const customer:Customer={id:old?.id||crypto.randomUUID(),name:str(a.name,100),email:mail,phone:str(a.phone,30),notes:typeof a.notes==='string'?a.notes.slice(0,2000):'',previousEmails};if(old)s.customers[s.customers.findIndex(c=>c.id===old.id)]=customer;else s.customers.unshift(customer);
 }
 else if(a.type==='appointment'){
 const old=a.id?s.appointments.find(x=>x.id===a.id):undefined;if(a.id&&!old)throw Error('This appointment no longer exists.');const date=str(a.date,30);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||(date!==old?.date&&date<new Date().toISOString().slice(0,10)))throw Error('Choose today or a valid future date.');
 const status=a.status||old?.status||'Requested';if(!['Requested','Booked','Completed','Cancelled'].includes(status))throw Error('Choose a valid appointment status.');const appointment:Appointment={id:old?.id||crypto.randomUUID(),name:str(a.name,100),date,service:str(a.service,100),notes:typeof a.notes==='string'?a.notes.slice(0,2000):'',status};if(old)s.appointments[s.appointments.findIndex(x=>x.id===old.id)]=appointment;else s.appointments.unshift(appointment);
 }else if(a.type==='appointmentStatus'){
 const x=s.appointments.find(x=>x.id===a.id);if(!x||!['Requested','Booked','Completed','Cancelled'].includes(a.status))throw Error('Invalid appointment.');x.status=a.status;
 }else if(a.type==='order'){
 if(a.accountId&&a.checkoutId&&s.orders.some(order=>order.accountId===a.accountId&&order.checkoutId===a.checkoutId))return s;
 if(!Array.isArray(a.items)||!a.items.length||a.items.length>30)throw Error('Your bag is empty or too large.');
 const items=a.items.map((i:any)=>{const p=s.products.find(p=>p.id===i.product);if(!p||p.archived||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>10||!['S','M','L','XL'].includes(i.size))throw Error('Invalid or unavailable bag item.');if(p.stock<i.quantity)throw Error(p.name+' has insufficient stock.');p.stock-=i.quantity;return {product:p.id,name:p.name,price:p.price,quantity:i.quantity,size:i.size};});
 const customer=str(a.name,100),mail=email(a.email);
 const shipping=a.shipping??0;if(!Number.isSafeInteger(shipping)||shipping<0||shipping>10000)throw Error('Invalid delivery charge.');s.orders.unshift({id:'AR-'+crypto.randomUUID().slice(0,8).toUpperCase(),customer,email:mail,address:str(a.address,1000),items,total:items.reduce((n:number,i:any)=>n+i.price*i.quantity,0)+shipping,date:new Date().toISOString(),status:'New',accountId:typeof a.accountId==='string'?str(a.accountId,100):undefined,checkoutId:typeof a.checkoutId==='string'?str(a.checkoutId,100):undefined,shipping,paymentMethod:'cod',paymentStatus:'Unpaid',notes:optional(a.notes,'',500)});
 if(!s.customers.some(x=>x.email===mail))s.customers.unshift({id:crypto.randomUUID(),name:customer,email:mail,phone:typeof a.phone==='string'?a.phone.slice(0,30):'',notes:''});
 }else if(a.type==='orderPayment'){
 const order=s.orders.find(order=>order.id===a.id);if(!order||!['Unpaid','Paid','Refunded'].includes(a.paymentStatus))throw Error('Choose a valid order and payment status.');order.paymentStatus=a.paymentStatus;
 }else if(a.type==='status'){
 const o=s.orders.find(x=>x.id===a.id);if(!o||!statuses.includes(a.status))throw Error('Invalid order status.');if(o.status==='Cancelled'&&a.status!=='Cancelled')throw Error('Cancelled orders cannot be reopened.');
 if(a.status==='Cancelled'&&o.status!=='Cancelled')for(const i of o.items){const p=s.products.find(p=>p.id===i.product);if(p)p.stock+=i.quantity;}o.status=a.status;
 }else throw Error('Unknown action.');return s;
}
