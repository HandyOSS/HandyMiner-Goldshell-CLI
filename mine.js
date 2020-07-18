const hrInit = process.env.HANDYRAW;
const HandyMiner = require('./miner/HandyMiner_GoldShell.js');
const Configurator = require('./miner/configurator.js');
const fs = require('fs');
const spawn = require('child_process').spawn;

fs.readFile('./goldshell.json',(err,data)=>{
	if(!err){
		if(typeof hrInit == "undefined"){
			delete process.env.HANDYRAW;
		}
		const miner = new HandyMiner();		
	}
	else{
		const configurator = new Configurator();
		configurator.configure().then(()=>{
			if(typeof hrInit == "undefined"){
				delete process.env.HANDYRAW;
			}
			//we spawn like this because a module in the configurator
			//closes the process before the asic shuts down, meaning
			//it stays running/messes up the workflows, sheesh..
			let minerProcess = spawn('node',[__dirname+'/mine.js'],{env:process.env});
			minerProcess.stdout.pipe(process.stdout);
			
		}).catch(e=>{});
	}		
});
