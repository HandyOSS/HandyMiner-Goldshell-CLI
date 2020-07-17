const blessed = require('blessed');
const contrib = require('blessed-contrib');
const moment = require('moment');
const numeral = require('numeral');
const hrInit = process.env.HANDYRAW;
const Configurator = require('./configurator.js');
const spawn = require('child_process').spawn;
const fs = require('fs');


class CLIDashboard{
	constructor(){
		
		this.linechartTicksMax = 50;
		this.gridWidth = 8;
		//console.log('new dashboard');
		this.colors = ["#FF0000","#FFFF00","#00FF00","#0000FF","#FF00FF","#00FFFF"]
		this.statsData = {
			shares:0,
			errors:0,
			last:undefined,
			started:moment(),
			hashrate:0,
			hashrate120:0,
			target:0,
			difficulty:0,
			networkDifficulty:0
		}

	  	
    	fs.readFile(__dirname+'/../goldshell.json',(err,data)=>{
			if(!err){
				this.config = JSON.parse(data.toString('utf8'));
				this.startMiner();
				this.initBlessed();
			}
			else{
				const configurator = new Configurator();
				configurator.configure(()=>{
					this.config = JSON.parse(fs.readFileSync(__dirname+'/../goldshell.json','utf8'));
					this.startMiner();
					this.initBlessed();

				});
			}		
		});
		
	}
	initBlessed(){
		this.screen = blessed.screen();
		this.grid = new contrib.grid({rows: 4, cols: this.gridWidth, screen: this.screen})
		let _this = this;
	    this.screen.key(['escape', 'q', 'C-c'], (ch, key)=> {
		  	
		  	this.screen.destroy();
		  	
		  	this.rainbow();
		  	if(typeof this.powerTimer != "undefined"){
		  		clearTimeout(this.powerTimer);
		  	}
		  	if(typeof this.minerProcess != "undefined"){
		  		try{
		  			this.minerProcess.stdin.write('dashboard sigint');
		  		}
		  		catch(e){

		  		}
		  	}
		  	return process.exit(0);
	    });
	}
	
	updateAsicStats(data){
		/*
		let asicData = {
          type:'asicStats',
          data:{
            temp:this.asicStats[asicID].temp,
            fanRpm: this.asicStats[asicID].fanRpm,
            voltage: this.asicStats[asicID].voltage,
            frequency: this.asicStats[asicID].frequency,
            asicID: asicID,
            name: this.asicNames[asicID].modelName,
            serial: this.asicNames[asicID].serial,
            hashrateNow: Math.round(perAsicRateNow[asicID]*100)/100,
            hashrateAvg: Math.round(perAsicRateAvg[asicID]*100)/100,
            workerHashrates:workerHashrates,
            solutions: this.asicShares[asicID]
          }
        }
		*/
		let key = data.data.asicID;
		this.asics[key].data.temperature.push({temperature:parseFloat(data.data.temp),time:moment().format('HH:mm')});
		this.asics[key].data.fan.push({fans:parseFloat(data.data.fanRpm),time:moment().format('HH:mm')});
		this.asics[key].data.asicCoreClock.push({clock:parseFloat(data.data.frequency),time:moment().format('HH:mm')});
		this.asics[key].data.asicMemoryClock.push({clock:parseFloat(data.data.frequency),time:moment().format('HH:mm')});
		this.asics[key].data.power.push({power:57.0,time:moment().format('HH:mm')});
		this.asics[key].data.voltage.push({voltage:parseFloat(data.data.voltage),time:moment().format('HH:mm')});
		this.asics[key].invalid = data.data.solutions.invalid;
		this.asics[key].valid = data.data.solutions.valid;
		this.updatePowerChart();
		this.updateFanChart();
		this.updateSparkLines();
		this.updateInvalidSharesStats();
	}
	updateInvalidSharesStats(){
		let sumInvalid = 0;
		Object.keys(this.asics).map(key=>{
			let asic = this.asics[key];
			sumInvalid += asic.invalid;
		});
		this.updateStats(sumInvalid,'errors');

	}
	updateSparkLines(){
		let memSpeedLabels = [];
		let memSpeedDatas = [];
		if(typeof this.asics == "undefined") return;
		Object.keys(this.asics).map(k=>{
			let asic = this.asics[k];
			let name = asic.info.modelName;
			let data = [];
			let last = 0;
			let mData = asic.data.asicMemoryClock;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				this.asics[k].data.asicMemoryClock = mData;
			}
			mData = mData.map(d=>{return d.clock;});
			data = mData;
			last = mData[mData.length-1] || 0;
			memSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
			memSpeedDatas.push(data);
			//console.log('mespeed data',data);
		});
		//console.log('memspeedLabels',memSpeedLabels);
		this.memSpeedArea.setData(memSpeedLabels,memSpeedDatas);

		let asicSpeedLabels = [];
		let asicSpeedDatas = [];
		if(typeof this.asics == "undefined") return;
		Object.keys(this.asics).map(k=>{
			let asic = this.asics[k];
			let name = asic.info.serialPort+'.'+asic.info.modelName;
			let data = [];
			let last = 0;
			let mData = asic.data.asicCoreClock;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				this.asics[k].data.asicCoreClock = mData;
			}
			mData = mData.map(d=>{return d.clock;});
			data = mData;
			last = mData[mData.length-1] || 0;
			asicSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
			asicSpeedDatas.push(data);

		});
		//console.log('asicspeedLabels',asicSpeedLabels);
		this.asicSpeedArea.setData(asicSpeedLabels,asicSpeedDatas);

		let voltageLabels = [];
		let voltageDatas = [];
		if(typeof this.asics == "undefined") return;
		Object.keys(this.asics).map(k=>{
			let asic = this.asics[k];
			let name = asic.info.serialPort+'.'+asic.info.modelName;
			let data = [];
			let last = 0;

			let mData = asic.data.voltage;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				/*if( process.platform.indexOf('linux') >= 0){
					this.asics[k].data.power = mData;
				}
				else{*/
					this.asics[k].data.voltage = mData;
				//}
				
			}
			mData = mData.map(d=>{return d.voltage;});
			data = mData;
			last = mData[mData.length-1] || 0;
			//console.log('voltage datas',data);
			let label = 'mV';
			voltageLabels.push(name+' \x1b[36m'+(last)+label+'\x1b[0m');
			voltageDatas.push(data)
		});
		//console.log('voltageLabels',voltageLabels);
		this.voltageSpeedArea.setData(voltageLabels,voltageDatas);
	}
	updateFanChart(){
		//update fan sparkline
		let eV = [];
	 	let fV = [];
	 	let energySum = 0;
	 	let fanSum = 0;
	 	let fanCount = 0;
	 	if(typeof this.asics == "undefined"){
	 		return;
	 	}
	 	Object.keys(this.asics).map((k,i)=>{
	 		let asic = this.asics[k];
	 		if(asic.data.power.length > this.linechartTicksMax){
	 			this.asics[k].data.power = this.asics[k].data.power.slice(this.asics[k].data.power.length-this.linechartTicksMax/2,this.asics[k].data.power.length);
	 		}
	 		if(asic.data.fan.length > this.linechartTicksMax){
	 			this.asics[k].data.fan = this.asics[k].data.fan.slice(this.asics[k].data.fan.length-this.linechartTicksMax/2,this.asics[k].data.fan.length);
	 		}
	 		if(i == 0){
	 			eV = asic.data.power.map(d=>{return d.power;});
	 			/*if(process.platform.indexOf('linux') >= 0 || process.platform.indexOf('darwin') >= 0){
	 				fV = asic.data.fan.map(d=>{return d.fans;});
	 			}
	 			else{
	 				fV = asic.data.fan.map(d=>{return d.fans/255*100;});	
	 			}*/
	 			fV = asic.data.fan.map(d=>{ return d.fans;});
	 			
	 		}
	 		else{
	 			asic.data.power.map((v,ii)=>{
	 				if(typeof eV[ii] != "undefined"){
	 					eV[ii] += v.power;
	 				}
	 			})
	 			asic.data.fan.map((v,ii)=>{
	 				if(typeof fV[ii] != "undefined"){
	 					/*if(process.platform.indexOf('linux') >= 0 || process.platform.indexOf('darwin') >= 0){
	 						fV[ii] += v.fans;
	 					}
	 					else{
	 						fV[ii] += v.fans/255*100;	
	 					}*/
	 					fV[ii] += v.fans;
	 					
	 				}
	 			})
	 		}
	 	});
	 	if(eV.length > this.linechartTicksMax){
	 		eV = eV.slice(eV.length-(this.linechartTicksMax/2),eV.length);
	 	}
	 	if(fV.length > this.linechartTicksMax){
	 		fV = fV.slice(fV.length-(this.linechartTicksMax/2),fV.length);
	 	}
	 	let eVLast = eV[eV.length-1] || 0;
	 	let fVLast = fV[fV.length-1] || 0;
	 	eVLast = Math.floor(eVLast);
	 	fVLast = Math.round(fVLast/Object.keys(this.asics).length);
	  	this.energyArea.setData(['Energy \x1b[36m'+eVLast+'W\x1b[0m','Avg Fan Speed \x1b[36m'+(Math.floor(fVLast))+'\x1b[0m'],[eV,fV]);
	}
	updatePowerChart(){
		let xNow = moment();
	    let tempSeriesData = [];
	    //console.log('draw hashrate');
	    //return false;
	    if(typeof this.asics == "undefined"){
	    	return;
	    }
	    Object.keys(this.asics).map(asicKey=>{
	    	let asicData = this.asics[asicKey];
	    	let name = asicData.info.serialPort+'.'+asicData.info.modelName;
	    	let tempData = asicData.data.temperature;
	    	let xData = [];
		    let yData = [];
		    let xData2 = [];
		    let yData2 = [];
		    if(tempData.length > this.linechartTicksMax){
		    	tempData = tempData.slice(tempData.length-(this.linechartTicksMax/2),tempData.length);
		    	this.asics[asicKey].data.temperature = tempData;
		    }
		    tempData.map((d,i)=>{
		    	yData.push(d.temperature);
		    	let modRate = 100;
		    	if(tempData.length < this.linechartTicksMax){
		    		modRate = 10;
		    	}
		    	if(tempData.length < this.linechartTicksMax/2){
		    		modRate = 5;
		    	}
		    	if(tempData.length < this.linechartTicksMax/4){
		    		modRate = 2;
		    	}
		    	//xData.push(d.time);
		    	xData.push(i % modRate == 0 ? d.time : ' ');
		    })
		    //console.log('xData',xData);
		    /*for(let i=0;i<20;i++){
		    	let t = xNow.clone().subtract(20-i,'minutes');
		    	xData.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
		    	xData2.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
		    	yData.push(Math.random()*20);
		    	yData2.push(Math.random()*20);
		    }*/

			  var series1 = {
			         title: name,
			         x: xData,//['t1', 't2', 't3', 't4'],
			         y: yData,//[5, 1, 7, 5],
			         style:{
				         line:asicData.color,
				         text:asicData.color
				       }
			      }
			  
			  tempSeriesData.push(series1);
	    })
	    this.tempChart.setData(tempSeriesData);
	    
	    this.screen.render();
	}
	
	
	startMiner(){
		console.log('STARTING MINER DASHBOARD...');
		let hasAddedASICs = false;
		let registeredASICs = [];

		//const miner = new HandyMiner();		
		process.env.HANDYRAW=true;
		let minerProcess = spawn('node',[__dirname+'/../mine.js'],{env:process.env});
		//console.log('miner process????',minerProcess);
		/*minerProcess.stderr.on('data',d=>{
			console.log('sterr',d.toString('utf8'))
		})*/
		minerProcess.stdout.on('data',d=>{
			
			let dN = d.toString('utf8').split('\n');
			//console.log('miner stdout isset',dN);
			let didConfirm = false;
			dN.map((line)=>{
				try{
					let json = JSON.parse(line.toString('utf8'));
					//console.log('data back',json);
					if(json.type == 'registration'){

						//console.log('will show devices now',json);
						//showDevices(json.data);
						if(!hasAddedASICs){
							let numDevices = json.data.numDevices;
							registeredASICs = registeredASICs.concat(json.data);
							if(registeredASICs.length == numDevices){
								hasAddedASICs = true;
								let s = '';
								let r = process.stdout.rows;
								for(let i=0;i<r;i++){
									s += '\n';//clear out the screen then
								}
								console.log(s);
								this.addASICs(registeredASICs);
							}
						}
						this.pushToLogs(json.data,'stdout');
					}
					else if(json.type == 'asicStats'){
						this.pushToLogs([json],'stdout');
					}
					else{
						
						if(json.type == 'confirmation' && typeof json.granule != "undefined" /*&& !didConfirm*/){
							//didConfirm just in case there is some duplicate message in the same batch of lines. If you're crushing blocks like that why does it matter we show blinky this many times anyway..
							//removing didconfirm logic because dashboard GUI is missing blocks sometimes...... :facepalm:
							didConfirm = true;
							this.statsData.shares++;
							this.updateStats(moment(),'last');
							this.initFanfare(json);
						}
						if(!hasAddedASICs && json.type != "difficulty"){
							console.log(json);
						}
						//console.log(json);
						if(json.action == 'stratumLog' || json.action == 'log' || json.type == 'log'){
							//its a status updat
							this.pushToLogs(json.data||[json],'stdout');
						}
						else{
							this.pushToLogs(json.data || [json],'stdout');
						}
						
					}
					if(json.type == 'error'){
						this.pushToLogs(json.data,'error');
					}
					
				}
				catch(e){
					//console.log('error',e);
				}
			})
		});
		this.minerProcess = minerProcess;

	}
	initFanfare(json){
		let logInitLines = [
			'################',
			'       ___      ',
			'     /__/\\    ',
			'     \\  \\:\\   ',
			'      \\__\\:\\  ',
			'  ___ /  /::\\ ',
			' /__/\\  /:/\\:\\',
			' \\  \\:\\/:/__\\/',
			'  \\  \\::/     ',
			'   \\  \\:\\     ',
			'    \\  \\:\\    ',
			'     \\__\\/    ',
			'                ',
			'################',
			'ACCEPTED '+json.granule+'!',
			'# '+moment().format('MMM-DD HH:mm:ss')+' #',
			'################'
		];
		let width;
		width = process.stdout.columns * 0.5;
		
		logInitLines = logInitLines.map(line=>{
			let lineW = line.length;
			let diff = Math.floor((width-lineW)/2);
			let pad = '';
			let pad2 = '\x1b[32;5;7m';
			let pad3 = '';
			for(let i=0;i<diff;i++){
				if(line.indexOf('#') >= 0){
					pad += '#'
				}
				else{
					pad += ' ';
					pad2 += ' ';
					pad3 += ' ';
				}
				
			}
			pad3 += '\x1b[0m';
			
			if(line.indexOf('#') >= 0){
				this.logsBox.log(pad+line+pad);
			}
			else{
				this.logsBox.log(pad2+line+pad3);
			}
			if(this.logsBox.logLines.length > 2000){
				this.logsBox.logLines = this.logsBox.logLines.slice(this.logsBox.logLines.length-500,this.logsBox.logLines.length);
			}
		});
	}
	pushToLogs(jsonLines,type){
		jsonLines.map(json=>{

			switch(json.type){
				case 'status':
				case 'asicStats':
					//hashrte update
					let hr = json.data.hashrateNow;
					let hr120 = json.data.hashrateAvg;
					let gpuID = json.data.asicID;
					let platform = json.data.asicID;
					let modelName = json.data.name;
					
					this.asics[platform].data.hashrate.push({hashrate:hr,time:moment().format('HH:mm')});
					this.asics[platform].data.hashrate120.push({hashrate:hr120,time:moment().format('HH:mm')});
					this.actuallyLog('ASIC '+gpuID+'.'+modelName+': \x1b[36m'+(numeral(hr).format('0.00'))+'GH AVG: '+(numeral(hr120).format('0.00'))+'GH\x1b[0m');
					this.drawHashrate();
					this.updateAsicStats(json);
					
				break;
				case 'difficulty':
					this.statsData.difficulty = json.difficulty;
					this.statsData.networkDifficulty = json.networkDifficulty;
					this.statsData.target = json.target;
					this.updateStats(this.statsData.target,'target');
				break;
				default:
					//console.log('\n some data is here???',json);
					//this.actuallyLog(JSON.stringify(json));
				break;
				
				case 'log':
				case 'stratumLog':
					this.actuallyLog(json);
				break;
			}
			
			
		});
	}
	actuallyLog(str){
		this.logsBox.log(str);
		this.screen.render();
	}
	drawHashrate(){
		let xNow = moment();
	    let hashrateSeriesData = [];
	    let tempSeriesData = [];
	    
	    Object.keys(this.asics).map(asicKey=>{
	    	let asicData = this.asics[asicKey];
	    	let name = asicData.info.serialPort+'.'+asicData.info.modelName;
	    	let hashData = asicData.data.hashrate;
	    	let hd120 = asicData.data.hashrate120;
	    	let xData = [];
		    let yData = [];
		    let xData2 = [];
		    let yData2 = [];
		    if(hashData.length > this.linechartTicksMax){
		    	hashData = hashData.slice(hashData.length-(this.linechartTicksMax/2),hashData.length);
		    	this.asics[asicKey].data.hashrate = hashData;
		    }
		   	if(hd120.length > this.linechartTicksMax){
		    	hd120 = hd120.slice(hd120.length-(this.linechartTicksMax/2),hd120.length);
		    	this.asics[asicKey].data.hashrate120 = hd120;
		    }
		    hashData.map((d,i)=>{

		    	yData.push(parseInt(d.hashrate));
		    	let modRate = 100;
		    	if(hashData.length < this.linechartTicksMax){
		    		modRate = 10;
		    	}
		    	if(hashData.length < this.linechartTicksMax/2){
		    		modRate = 5;
		    	}
		    	if(hashData.length < this.linechartTicksMax/4){
		    		modRate = 2;
		    	}
		    	
		    	xData.push(i % modRate == 0 ? d.time : ' ');
		    	
		    })
		    
			var series1 = {
			     title: name,
			     x: xData,//['t1', 't2', 't3', 't4'],
			     y: yData,//[5, 1, 7, 5],
			     style:{
			         line:asicData.color,
			         text:asicData.color
			       }
			}

			hashrateSeriesData.push(series1);
	    })
	    this.hashChart.setData(hashrateSeriesData);
	    let sum = 0;
	    let sum120 = 0;
	    Object.keys(this.asics).map(key=>{
	    	let asic = this.asics[key];
	    	let last;
	    	if(asic.data.hashrate.length == 0){
	    		last = 0;
	    		return;
	    	}
	    	sum120 += asic.data.hashrate120[asic.data.hashrate120.length-1].hashrate;
	    	sum += asic.data.hashrate[asic.data.hashrate.length-1].hashrate;
	    });
	    
	    this.updateStats(sum,'hashrate');
	    this.updateStats(sum120,'hashrate120');
	    this.screen.render();
	}
	updateStats(data,type){
		this.statsData[type] = data;
		
		let statsData = [
	  	'Valid Shares: \x1b[36m'+numeral(this.statsData['shares']).format('0a')+'\x1b[0m',
	  	'Invalid Shares: \x1b[36m'+numeral(this.statsData['errors']).format('0a')+'\x1b[0m',
	  	'Last Share: \x1b[36m'+(typeof this.statsData['last'] == "undefined" ? 'none' : this.statsData['last'].format('MMM-DD HH:mm'))+'\x1b[0m',
	  	'Started: \x1b[36m'+this.statsData['started'].format('MMM-DD HH:mm')+'\x1b[0m',
	  	'Rig Hashrate: \x1b[36m'+(numeral(this.statsData['hashrate']).format('0.00')+'GH')+'\x1b[0m',
	  	'Avg Hashrate: \x1b[36m'+(numeral(this.statsData['hashrate120']).format('0.00')+'GH')+'\x1b[0m',
	  	'Target: \x1b[36m0x'+(this.statsData.target.slice(0,32))+'\x1b[0m',
	  	'Share Diff: \x1b[36m'+(numeral(this.statsData.difficulty).format('0.0a'))+'\x1b[0m',
	  	'Network Diff: \x1b[36m'+(numeral(this.statsData.networkDifficulty).format('0.0a').toUpperCase())+'\x1b[0m'
	  ];
	  
	  this.statsBox.logLines = [];
	  statsData.map(d=>{
	  	this.statsBox.log(d);
	  })
	  

	  this.screen.render();
	}
	addASICs(asicList){
		//console.log('adding asics',asicList);
		let asicSet = {};
		let asicItems = asicList.map((asic,asicI)=>{
			let color = this.colors[ asicI % this.colors.length ];
			if(typeof color == "undefined"){
				console.log('color is undefined',this.colors.length,asicI,this.colors.length%asicI)
				//color = this.colors[0];
			}
			
			//apparently can round a hex to an 8bit
			let colorBytes = {
				r:parseInt('0x'+color.substring(1,3),16),
				g:parseInt('0x'+color.substring(3,5),16),
				b:parseInt('0x'+color.substring(5,7),16)
			};
			
			let color_8bit = [Math.floor(colorBytes.r),Math.floor(colorBytes.g),Math.floor(colorBytes.b)]//(red << 5) | (green << 2) | blue;
			
			let asicID = asic.serialPort;
			asicSet[asicID] = {
				info:asic,
				data:{
					temperature:[],
					power:[],
					fan:[],
					asicCoreClock:[],
					asicMemoryClock:[],
					voltage:[],
					load:[],
					memory:[],
					hashrate:[],
					hashrate120:[],
					difficulty:[]
				},
				color:color_8bit,
				temperature:0,
				power:0,
				fan:0,
				memory:0,
				hashrate:0,
				difficulty:0,
				invalid:0,
				valid:0
			}
		});
		this.asics = asicSet;
		
    let xNow = moment();
    let hashrateSeriesData = [];
    let tempSeriesData = [];
    Object.keys(asicSet).map(asicKey=>{
    	let asicData = asicSet[asicKey];
    	let name = asicData.info.serialPort+'.'+asicData.info.modelName;
    	
    	let xData = [];
	    let yData = [];
	    let xData2 = [];
	    let yData2 = [];
	    for(let i=0;i<20;i++){
	    	let t = xNow.clone().subtract(20-i,'minutes');
	    	xData.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
	    	xData2.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
	    	yData.push(0/*Math.random()*20*/);
	    	yData2.push(0/*Math.random()*20*/);
	    }
		  var series1 = {
		         title: name,
		         x: xData,//['t1', 't2', 't3', 't4'],
		         y: yData,//[5, 1, 7, 5],
		         style:{
			         line:asicData.color,
			         text:asicData.color
			       }
		      }
		  var series2 = {
		         title: name,
		         x: xData2,//['t1', 't2', 't3', 't4'],
		         y: yData2,//[2, 1, 4, 8],
		         style:{
			         line:asicData.color,
			         text:asicData.color
			       }
		      }
		  hashrateSeriesData.push(series1);
		  tempSeriesData.push(series2);
    })
    
	  let hashChart = this.grid.set(0,0,2,4,contrib.line,{
	  		label:'Hashrate (GH)',
          xLabelPadding: 3,
          xPadding: 5,
          showLegend: true,
          wholeNumbersOnly: false}); //must append before setting data

	  let tempChart = this.grid.set(0,4,2,4,contrib.line,{
	  		label:'ASIC Temperature (C)',
          xLabelPadding: 3,
          xPadding: 5,
          showLegend: true,
          wholeNumbersOnly: false}); //must append before setting data
	  let energyPosX = 2//process.platform.indexOf('darwin') >= 0 ? 0 : 3;
	  let energyArea = this.grid.set(2,energyPosX,1,2,contrib.sparkline,{
	  	label:'Power Usage',
	  	tags: true,
	  	labelPadding: 3,
      style: { fg: 'blue' }
	  })
	  let memPosX = 9;//offscreen... //process.platform.indexOf('darwin') >= 0 ? 9 : 0;
	  let memSpeedArea = this.grid.set(2,memPosX,2,1,contrib.sparkline,{
	  	label:'ASIC Memory',
	  	tags:true,
	  	labelPadding:3,
	  	style: {fg: 'blue'}
	  });
	  let asicSpeedPosX = 0;
	  let asicSpeedArea = this.grid.set(2,asicSpeedPosX,2,1,contrib.sparkline,{
	  	label:'ASIC Frequency',
	  	tags:true,
	  	labelPadding:3,
	  	style: {fg: 'blue'}
	  });
	  let voltageSpeedArea;
	  
	  let voltagePosX = 1;
	  voltageSpeedArea = this.grid.set(2,voltagePosX,2,1,contrib.sparkline,{
		label:'ASIC Voltage',
		tags:true,
		labelPadding:3,
		style: {fg: 'blue'}
	  });
	  
	  
	  let statsPosX = 2//process.platform.indexOf('darwin') >= 0 ? 0 : 3;
	  let statsBox = this.grid.set(3,statsPosX,1,2,contrib.log,{
	  	label:'Stats',
	  	yLabelPadding:2,
	  	yPadding:2
	  })
	  let logsPosX = 4//process.platform.indexOf('darwin') >= 0 ? 2 : 5;
	  let logsWidth = 4//process.platform.indexOf('darwin') >= 0 ? 6 : 3;
	  let logsBox = this.grid.set(2,logsPosX,2,logsWidth,contrib.log,{
	  	label:'Logs'
	  })

	  let memSpeedLabels = [];
	  let memSpeedDatas = [];
	  Object.keys(this.asics).map(k=>{
	  	let asic = this.asics[k];
	  	let name = asic.info.serialPort+'.'+asic.info.modelName;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 2000 );
	  		data.push( val );
	  		last = val;
	  	}
	  	memSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
	  	memSpeedDatas.push(data)
	  });
	  memSpeedArea.setData(memSpeedLabels,memSpeedDatas);

	  let asicSpeedLabels = [];
	  let asicSpeedDatas = [];
	  Object.keys(this.asics).map(k=>{
	  	let asic = this.asics[k];
	  	let name = asic.info.serialPort+'.'+asic.info.modelName;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 2000 );
	  		data.push( val );
	  		last = val;
	  	}
	  	asicSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
	  	asicSpeedDatas.push(data)
	  });
	  asicSpeedArea.setData(asicSpeedLabels,asicSpeedDatas);

	  let voltageSpeedLabels = [];
	  let voltageSpeedDatas = [];
	  Object.keys(this.asics).map(k=>{
	  	let asic = this.asics[k];
	  	let name = asic.info.serialPort+'.'+asic.info.modelName;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 1100 );
	  		data.push( val );
	  		last = val;
	  	}
	  	voltageSpeedLabels.push(name+' \x1b[36m'+last+'mV\x1b[0m');
	  	voltageSpeedDatas.push(data)
	  });
	  voltageSpeedArea.setData(voltageSpeedLabels,voltageSpeedDatas);

	  this.logsBox = logsBox;
	  this.hashChart = hashChart;
	  this.tempChart = tempChart;
	  this.energyArea = energyArea;
	  this.memSpeedArea = memSpeedArea;
	  this.asicSpeedArea = asicSpeedArea;
	  this.voltageSpeedArea = voltageSpeedArea;
	  this.statsBox = statsBox;
	  
	  hashChart.setData(hashrateSeriesData);
	  tempChart.setData(tempSeriesData);
	  
	  let eV = [];
	  let fV = [];
	  for(let i=0;i<100;i++){
	 	eV.push(0/*Math.random()*1600*/);
	 	fV.push(0/*Math.random()*100*/);
	  }
	  energyArea.setData(['Energy \x1b[36m---W\x1b[0m','Fan Speed \x1b[36m--%\x1b[0m'],[eV,fV]);
	  let statsData = [
	  	'Valid Shares: \x1b[36m0\x1b[0m',
	  	'Invalid Shares: \x1b[36m0\x1b[0m',
	  	'Last Share: \x1b[36mnone\x1b[0m',
	  	'Started: \x1b[36m'+moment().format('MMM-DD HH:mm')+'\x1b[0m',
	  	'Rig Hashrate:\x1b[36m---MH\x1b[0m',
	  	'Target: \x1b[36m---\x1b[0m',
	  	'Share Diff: \x1b[36m---\x1b[0m',
	  	'Network Diff: \x1b[36m---\x1b[0m'
	  ];
	  statsData.map(d=>{
	  	statsBox.log(d);
	  })
	  statsBox.logLines = statsData;
	  

		let logInitLines = [
		'################',
		'      ___     ',
		'     /__/\\    ',
		'     \\  \\:\\   ',
		'      \\__\\:\\  ',
		'  ___ /  /::\\ ',
		' /__/\\  /:/\\:\\',
		' \\  \\:\\/:/__\\/',
		'  \\  \\::/     ',
		'   \\  \\:\\     ',
		'    \\  \\:\\    ',
		'     \\__\\/    ',
		'                ',
		'################',
		'#   STARTING   #',
		'#  HANDYMINER  #',
		'################',
		'                '
		];
		let width;
		
		width = process.stdout.columns * 0.5;
		

		logInitLines = logInitLines.map(line=>{
			let lineW = line.length;
			let diff = Math.floor(width-lineW/2);
			let pad = '';
			for(let i=0;i<diff;i++){
				if(line.indexOf('#') >= 0){
					pad += '#'
				}
				else{
					pad += ' ';
				}
				
			}

			return pad+line+pad;
		});
		logsBox.logLines = logInitLines;

	  //this.screen.render();
	}
	rainbow(){
		let width = process.stdout.columns;
		let padding = '';
		for(let i=0;i<width;i++){
			padding += '#';
		}
		let lines = [
			'',
			'There is a pot of gold at the end of every rainbow,',
			'it is the community that is worth the diamonds.',
			''
		];

		console.log('');
		console.log(padding);
		console.log(padding);
		console.log('');
		console.log('                         \x1b[95m_________\x1b[0m')
		console.log('                      \x1b[95m.##\x1b[0m\x1b[36m@@\x1b[0m\x1b[32m&&&&\x1b[0m\x1b[36m@@\x1b[0m\x1b[95m##.\x1b[0m')
		console.log('                   \x1b[95m,##\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m::\x1b[0m\x1b[38;5;9m%&&&%%\x1b[0m\x1b[33m::\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m##.\x1b[0m')
		console.log('                  \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[38;5;1mHANDYMINER\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('                \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m00\'\x1b[0m         \x1b[38;5;1m\'00\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('               \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\'\x1b[0m             \x1b[38;5;1m\'0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('              \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                 \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		//console.log('             \x1b[95m"\x1b[0m" \x1b[33m\'\x1b[0m "                   " \' "\x1b[95m"\x1b[0m')
		console.log('           \x1b[33m_oOoOoOo_\x1b[0m                    \x1b[92mTHE\x1b[0m ')
		console.log('          (\x1b[33moOoOoOoOo\x1b[0m)                \x1b[92mHANDSHAKE\x1b[0m')
		console.log('           )\`"""""\`(                 \x1b[92mCOMMUNITY\x1b[0m')
		console.log('          /          \\              ')   
		console.log('         |    \x1b[92mHNS\x1b[0m     |              ')
		console.log('         \\           /              ')
		console.log('          \`=========\`')
		console.log('')
		console.log(padding);
		console.log(padding);
		lines.map(l=>{
			let diff = Math.floor(width-l.length)/2;
			let p0 = '', p1 = '';
			for(let i=0;i<diff;i++){
				p0 += ' ';
				p1 += ' ';
			}
			console.log(p0+l+p1);
		});
		console.log(padding);
		console.log(padding);
		console.log('');
	}

}

let dash = new CLIDashboard();



