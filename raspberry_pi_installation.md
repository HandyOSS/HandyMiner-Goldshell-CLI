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