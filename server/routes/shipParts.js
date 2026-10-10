const router=require('express').Router();
const jwt=require('jsonwebtoken');
const service=require('../services/shipParts');
router.use((req,res,next)=>{try {const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)return res.status(401).json({error:'UNAUTHORIZED'});const user=jwt.verify(token,process.env.JWT_SECRET);req.partWallet=String(user.wallet_address||user.wallet||user.walletAddress||'').toLowerCase().trim();if(!req.partWallet)return res.status(401).json({error:'UNAUTHORIZED'});next();}catch(_){res.status(401).json({error:'INVALID_TOKEN'});}});
function failure(res,error) {const code=error.message;const status=/NOT_FOUND/.test(code)?404:/INSUFFICIENT/.test(code)?402:/INVALID/.test(code)?400:/^(SHIP_|PART_|LEVEL_CHANGED|MAX_LEVEL|SLOT_OCCUPIED)/.test(code)?409:error.code==='23505'?409:500;
 if(status===500)console.error('[ship-parts]',error);res.status(status).json({error:error.code==='23505'?'SLOT_OCCUPIED':status===500?'PART_ACTION_FAILED':code});}
router.get('/',async(req,res)=>{try{res.json(await service.state(req.partWallet));}catch(e){failure(res,e);}});
router.post('/craft',async(req,res)=>{try{res.json(await service.craft(req.partWallet,req.body.part_code));}catch(e){failure(res,e);}});
for(const action of ['upgrade','equip','unequip'])router.post('/:id/'+action,async(req,res)=>{try{res.json(await service.mutate(req.partWallet,req.params.id,action,req.body.ship_id,req.body.expected_level));}catch(e){failure(res,e);}});
module.exports=router;
