### Linux Installation

Install node.js 14.x and deps
```
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install alsa-utils
```
Note: If you can't get nodejs 14.+ on your system, just make sure you can get 10.x+ like:
```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Now that node.js is installed, install the module dependencies for HandyMiner in the HandyMiner-Goldshell-GUI directory
```
git clone https://github.com/HandyMiner/HandyMiner-Goldshell-CLI.git
cd HandyMiner-Goldshell-CLI
npm install
```

#### Mine HNS.

cd into the HandyMiner-Goldshell-GUI directory

##### Pi 3 and below must only use the standard CLI:
```
node mine.js
```

##### Pi 4 and above have enough CPU to run the CLI Dashboard View:
```
node miner/dashboard.js
```

##### Notes: 
The first time you run ```node mine.js``` or ```node miner/dashboard.js``` a configurator will guide you through the steps to add your mining pool of choice, port, and wallet or username/password. 
A list of some common mining pools can be found here: [https://handyminer.github.io/HandyMiner-Goldshell-CLI/index.html](https://handyminer.github.io/HandyMiner-Goldshell-CLI/index.html)
