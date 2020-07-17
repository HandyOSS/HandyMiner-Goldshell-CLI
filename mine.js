const hrInit = process.env.HANDYRAW;
const HandyMiner = require('./miner/HandyMiner_GoldShell.js');
const Configurator = require('./miner/configurator.js');
const fs = require('fs');

fs.readFile('./goldshell.json',(err,data)=>{
	if(!err){
		if(typeof hrInit == "undefined"){
			delete process.env.HANDYRAW;
		}
		const miner = new HandyMiner();		
	}
	else{
		const configurator = new Configurator();
		configurator.configure(()=>{
			if(typeof hrInit == "undefined"){
				delete process.env.HANDYRAW;
			}
			let miner = new HandyMiner();
		});
	}		
});
