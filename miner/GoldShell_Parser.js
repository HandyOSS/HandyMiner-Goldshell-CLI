class GoldShellAsic{
	constructor(){

	}
	parseASICDeviceInfo(data,serialPath){
		const version = data[4];
		const packetLen = parseInt(data.slice(5,5+4).reverse().toString('hex'),16);
		const modelNameLen = data[9];
		const modelName = data.slice(10,10+16).toString('utf8');;
		const fwLen = data[26];
		const fwVersion = data.slice(27,27+8).toString('utf8');
		const serial = data.slice(35,35+32).toString('utf8');
		const hashRate = data.slice(67,67+32);
		const workDepth = data[99];
		//console.log('parse infos???',modelName,serial);
		return {
			serialPort:serialPath,
			modelName,
			firmwareVersion:fwVersion,
			serial,
			hashRate,
			workDepth
		};
		/*
		console.log('version',version);
		console.log('packetLen',packetLen);
		console.log('modelNameLen',modelNameLen);
		console.log('modelName',modelName);
		console.log('fwLen',fwLen);
		console.log('fwVersion',fwVersion);
		console.log('serial',serial);
		console.log('effective hashrate??',hashRate[0]);
		console.log('hashrate info??',hashRate.slice(0,32).toString('hex'));
		console.log('workDepth',workDepth);*/
	}
	parseASICStatus(data){
		const version = data[4];
		const packetLen = parseInt(data.slice(5,5+4).reverse().toString('hex'),16);
		const numChips = parseInt(data[9],16);
		const numCores = parseInt(data[10],16);
		const numGoodCores = parseInt(data[11],16);
		const scanBits = parseInt(data[12],16);
		const scanTime = parseInt(data.slice(13,13+2).reverse().toString('hex'),16);
		const voltage = parseInt(data.slice(15,15+2).reverse().toString('hex'),16);
		const frequency = parseInt(data.slice(17,17+2).reverse().toString('hex'),16);
		const mode = parseInt(data.slice(19,19+4).reverse().toString('hex'),16);
		const temp = data[23];
		const rebootCnt = data[24];
		const tempWarn = data[25];
		const fanWarn = data[26];
		const powerWarn = data[27];
		const fanRpm = parseInt(data.slice(28,28+2).reverse().toString('hex'),16);
		
		return {
			numChips,
			numCores,
			numGoodCores,
			voltage,
			frequency,
			temp,
			rebootCnt,
			tempWarn,
			fanWarn,
			powerWarn,
			fanRpm
		}
		/*console.log('device status: ver',version)
		console.log('device status: packetLen',packetLen);
		console.log('device status: numChips',numChips);
		console.log('device status: numCores',numCores);
		console.log('device status: goodCores',numGoodCores);
		console.log('device status: scanBits',scanBits);
		console.log('device status: scanTime',scanTime);
		console.log('device status: voltage',voltage);
		console.log('device status: frequency',frequency);
		console.log('device status: mode',mode);
		console.log('device status: temp',temp);
		console.log('device status: rebootCnt',rebootCnt);
		console.log('device status: tempWarn',tempWarn);
		console.log('device status: fanWarn',fanWarn);
		console.log('device status: powerWarn',powerWarn);
		console.log('device status: fanRpm',fanRpm);*/
	}
	parseASICNonce(data){
		const version = data[4];
		const packetLen = parseInt(data.slice(5,5+4).reverse().toString('hex'),16);
		const jobID = data[9];
		const chipID = data[10];
		const coreID = data[11];
		const nonce = data.slice(12,12+8).reverse().toString('hex');
		const hashExists = data[20];
		const hash = data.slice(21,21+32);
		/*console.log('nonce received version',version);
		console.log('nonce received packetLen',packetLen);
		console.log('nonce received jobID',jobID);
		console.log('nonce received chipID',chipID);
		console.log('nonce received coreID',coreID);
		console.log('nonce received nonce',nonce);
		console.log('nonce received hashExists?',hashExists);
		console.log('nonce received hash',hash.reverse().toString('hex'));*/
		return {
			jobID,
			chipID,
			coreID,
			nonce,
			hashExists,
			hash:hash.reverse().toString('hex')
		}
	}
}
module.exports = GoldShellAsic;