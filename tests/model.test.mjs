import test from 'node:test';
import assert from 'node:assert/strict';
import {initialShop,reduceShop} from '../app/model.ts';
const request={type:'order',name:'Test Customer',email:'test@example.com',address:'123 Test Road',phone:'1234567890',items:[{product:'sage',size:'M',quantity:2,price:1}]};
test('uses catalogue prices, reduces stock, creates customer and leaves original intact',()=>{const s=reduceShop(initialShop,request);assert.equal(s.orders[0].total,7780);assert.equal(s.products[1].stock,16);assert.equal(initialShop.products[1].stock,18);assert.equal(s.customers.length,1);});
test('duplicate bag entries cannot oversell inventory',()=>{assert.throws(()=>reduceShop(initialShop,{...request,items:[{product:'wine',quantity:4,size:'M'},{product:'wine',quantity:4,size:'S'}]}),/stock/);});
test('cancellation restores stock exactly once and cannot reopen',()=>{let s=reduceShop(initialShop,request);const id=s.orders[0].id;s=reduceShop(s,{type:'status',id,status:'Cancelled'});assert.equal(s.products[1].stock,18);s=reduceShop(s,{type:'status',id,status:'Cancelled'});assert.equal(s.products[1].stock,18);assert.throws(()=>reduceShop(s,{type:'status',id,status:'Confirmed'}),/reopened/);});
test('rejects empty bags, unknown products, fractional quantities and invalid sizes',()=>{for(const items of [[],[{product:'missing',quantity:1,size:'M'}],[{product:'sage',quantity:1.5,size:'M'}],[{product:'sage',quantity:1,size:'XX'}]])assert.throws(()=>reduceShop(initialShop,{...request,items}));});
test('validates product stock and customer email',()=>{assert.throws(()=>reduceShop(initialShop,{type:'product',product:{...initialShop.products[0],stock:-1}}));assert.throws(()=>reduceShop(initialShop,{type:'customer',name:'Test',email:'bad',phone:'123'}));});
