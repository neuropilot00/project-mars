/* Shared realistic Mars terrains. Atlas cells are complete battlefields, in row-major order. */
(function () {
  'use strict';
  var registry = Object.create(null);
  function single(key, path) { registry[key] = Object.freeze({key:key,path:path,columns:1,rows:1,column:0,row:0}); }
  function atlas(name, keys) {
    keys.forEach(function (key, index) {
      registry[key] = Object.freeze({key:key,path:'/assets/battlefields/realistic-atlas-'+name+'.webp',columns:2,rows:2,column:index%2,row:Math.floor(index/2)});
    });
  }
  single('garrison','/assets/textures/battlefields/mars_garrison_realistic.png');
  single('occupation_grid_airspace','/assets/textures/battlefields/mars_occupation_grid_airspace_topdown.png');
  single('minehead_trench','/assets/textures/battlefields/mars_minehead_trench_topdown.png');
  single('dome_defense_line','/assets/textures/battlefields/mars_dome_defense_line_topdown.png');
  single('crater_relay','/assets/battlefields/realistic-crater-relay.webp');
  single('convoy_route','/assets/battlefields/realistic-convoy-route.webp');
  single('orbital_blockade','/assets/battlefields/realistic-orbital-blockade.webp');
  atlas('a',['orbit_territory','mining_site','canyon_outpost','polar_ice']);
  atlas('b',['lava_tube','refinery_yard','colony_dome','excavation_grid']);
  atlas('c',['dust_storm','occupied_airspace','shipyard_drydock','ancient_ruins']);
  atlas('d',['garrison_rooftop','deep_mine','settlement_airspace','orbital_minefield']);
  var fallback = Object.freeze({key:'',path:'/assets/textures/mars_nasa_2k.jpg',columns:1,rows:1,column:0,row:0});
  var backgrounds = Object.create(null);
  Object.keys(registry).forEach(function (key) { backgrounds[key] = registry[key].path; });
  function resolve(key) { return registry[String(key || '').trim().toLowerCase()] || fallback; }
  // Only trusted registry paths enter inline CSS. Unknown input resolves to the neutral Mars texture.
  function thumbnailStyle(key) {
    var art = resolve(key);
    return 'background-image:url('+art.path+');background-repeat:no-repeat;background-size:'+
      (art.columns===1?'cover':art.columns*100+'% '+art.rows*100+'%')+';background-position:'+
      (art.columns===1?'center':art.column/(art.columns-1)*100+'% '+art.row/(art.rows-1)*100+'%')+';';
  }
  function sourceRect(key, width, height) {
    var art = resolve(key), w = width/art.columns, h = height/art.rows;
    return {x:art.column*w,y:art.row*h,width:w,height:h};
  }
  window.BattlefieldArt = Object.freeze({resolve:resolve,thumbnailStyle:thumbnailStyle,sourceRect:sourceRect,backgrounds:Object.freeze(backgrounds),keys:Object.freeze(Object.keys(registry))});
})();
