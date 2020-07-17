const Configurator = require('./miner/configurator.js');
const spawn = require('child_process').spawn;

const configurator = new Configurator();
let miner;

configurator.configure().then(()=>{
	doMining();
}).catch(e=>{});

function doMining(){
	delete process.env.HANDYRAW;
	let minerProcess = spawn('node',[__dirname+'/mine.js'],{env:process.env});
	minerProcess.stdout.pipe(process.stdout);
}


