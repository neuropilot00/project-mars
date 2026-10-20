'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const service = require('../services/starterOperations');
function requireAuth(req,res,next){
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token)return res.status(401).json({error:'UNAUTHORIZED'});
  try{req.user=jwt.verify(token,process.env.JWT_SECRET);next();}catch(_){return res.status(401).json({error:'INVALID_TOKEN'});}
}
function wallet(req){return String(req.user?.wallet_address||req.user?.wallet||req.user?.walletAddress||'').trim().toLowerCase();}
const STATUS={INVALID_OPENING_TACTIC:400,INVALID_MISSION:400,INVALID_OBJECTIVE:400,INVALID_ACTION:400,NODE_REQUIRED:400,SHIP_REQUIRED:400,FLEET_AND_AMOUNT_REQUIRED:400,FLEET_AND_NODE_REQUIRED:400,NODE_AND_FLEET_REQUIRED:400,FACTION_REQUIRED:409,STARTER_HULLS_UNAVAILABLE:409,STARTER_GRANT_SHIP_UNAVAILABLE:409,PREVIOUS_MISSION_REQUIRED:409,MISSION_ALREADY_FINISHED:409,MISSION_ALREADY_COMPLETE:409,MISSION_NOT_COMPLETE:409,MISSION_NOT_ACTIVE:409,SOURCE_NOT_VERIFIED:409,CARGO_NOT_ARRIVED:409,STARTER_FLEET_REQUIRED:409,STARTER_SHIP_REQUIRED:409,FRONTIER_STOCK_FULL:409,PUBLIC_RISK_CONSENT_REQUIRED:409,REPAIR_QUOTE_CHANGED:409,RESOURCE_NODE_REQUIRED:400,REPAIR_REQUIRED:409,TRAINING_FRONT_LOCKED:409};
function fail(res,e,where){let status=STATUS[e.message];if(!status&&/^(FLEET_|NODE_|NOT_|ALREADY_|PRODUCTION_|CARGO_|FRONTIER_|INSUFFICIENT_|SHIP_|REPAIR_|BATTLE_)/.test(e.message))status=409;if(!status)status=500;if(status===500)console.error('[starter-ops] '+where+':',e.message);return res.status(status).json({error:status===500?'SERVER_ERROR':e.message,meta:e.meta||undefined});}
router.get('/starter-ops/state',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});res.json(await service.getState(w));}catch(e){fail(res,e,'state');}});
router.get('/starter-ops/frontier-state',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});res.json(await service.getFrontierState(w));}catch(e){fail(res,e,'frontier-state');}});
router.get('/starter-ops/repair-quote',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});if(!req.query.shipId)return res.status(400).json({error:'SHIP_REQUIRED'});res.json({success:true,quote:await service.getRepairQuote(w,req.query.shipId,req.query.targetHpPct)});}catch(e){fail(res,e,'repair-quote');}});
router.post('/starter-ops/:missionId/start',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});res.json(await service.start(w,req.params.missionId,req.body||{}));}catch(e){fail(res,e,'start');}});
router.post('/starter-ops/:missionId/action',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});res.json(await service.action(w,req.params.missionId,req.body||{}));}catch(e){fail(res,e,'action');}});
router.post('/starter-ops/:missionId/claim',requireAuth,async(req,res)=>{try{const w=wallet(req);if(!w)return res.status(401).json({error:'NO_WALLET'});res.json(await service.claim(w,req.params.missionId));}catch(e){fail(res,e,'claim');}});
module.exports=router;
