<a id="runFullnode"></a>
### Running an HSD Fullnode for solo mining

There are some handy docker utilities in the folder ```./fullnode_utils``` which you can double click on Mac/Windows/Linux to create, launch, stop or nuke a stratum-enabled fullnode on your local machine that you can mine to. Any utilities specific to the network (main|testnet|simnet) are noted in the command names. 

<a id="dockerReminders"></a>
#### Docker Fullnode Reminders:
1. Make sure you installed docker. PSA: you dont need to login to docker either, dont let them fool you [mac, hunt for the dmg link](https://docs.docker.com/docker-for-mac/release-notes/) [windows, hunt for the exe link](https://docs.docker.com/docker-for-windows/release-notes/) ). Even after you install it: you dont need to login in order to run this goodness.
2. Make sure that you added your wallet address you'd like paid at to ```run.mac.command OR run.windows.bat OR run.sh (for production)``` or ```run.powng.mac.command OR run.powng.windows.bat OR run.powng.sh (for simnet)``` in the end of the command that looks like: ```"./run.sh hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8"```

#### Docker Fullnode FAQs:

1. I get an error:: ``` Error response from daemon: driver failed programming external connectivity on endpoint earthlabHSD (...) Error starting userland proxy: mkdir /port/tcp:0.0.0.0:14038:tcp:172.17.0.2:14038: input/output error Error: failed to start containers: earthlabHSD ``` 
Right click the docker icon in your taskbar and 'restart docker'. It might take a couple minutes to fully restart.

2. Can I access the hsd docker fullnode? 
Yes. Port 15937 will be open for RPC calls to the node per usual, else ssh into the container's hsd directory with::
```docker exec -it earthlabHSD bash```
Windows:
```winpty docker exec -it earthlabHSD bash```

3. I'd like to import my wallet into this fullnode, How do I set my fullnode's API password and/or stratum password to something more meaningful? 

Edit the file you run the fullnode with, ```run.mac.command``` or ```run.windows.bat``` for example, and add the 3rd and 4th parameters into run.sh like:::
```docker start earthlabHSD && docker exec -i earthlabHSD sh -c "./run.sh hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8 main my_hsd_api_password_here my_stratum_password_here"``` 
and pay attention that the passwords are inside that double quote ^^

4. If you don't want to run a Dockerized fullnode, you can feel free to check the docs in ```fullnode_native_readme.md``` to see how to launch your own native hsd fullnode.
