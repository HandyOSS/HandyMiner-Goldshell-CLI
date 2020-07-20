/*******
HandyMiner Setup Guide
Copyright 2020 Alex Smith alex.smith@earthlab.tech

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
********/
let app;
$(document).ready(()=>{
	app = new HandyGuide();
});

class HandyGuide{
	constructor(){
		//////CHANGEME WHEN MINER UPDATES HAPPEN
		this.zipDownloadLink = 'https://github.com/HandyMiner/HandyMiner-Goldshell-CLI/archive/0.0.1.zip';
		this.tarDownloadLink = 'https://github.com/HandyMiner/HandyMiner-Goldshell-CLI/archive/0.0.1.tar.xz';
		//END CHANGEME

		this.changeLanguages();
		this.constructLinks();
		this.initLogo();
		setTimeout(()=>{
			this.hideLoading();
		},3000);
		this.initEvents();
		
	}
	changeLanguages(){
		let langSelection = window.localStorage.getItem('language');
		if(langSelection == null){
			langSelection = 'en';
		}
		this.changeLanguage(langSelection);
		$('#language').on('change',()=>{
			let val = $('#language option:selected').val();
			window.localStorage.setItem('language',val);
			this.changeLanguage(val);
		});
	}
	changeLanguage(language){
		$('#language option').removeAttr('selected');
		$('#language option[value="'+language+'"]').attr('selected','selected');
		let langContents = './content_'+language+'.html';
		$.get(langContents,(d)=>{
			$('#main').remove();
			$('#header').remove();
			$('#content').prepend($(d));
			this.constructLinks();
			this.initEvents();
		});
	}
	constructLinks(){
		let zipLink = this.zipDownloadLink;
		let tarLink = this.tarDownloadLink;
		$('#downloadZIP').attr('href',zipLink);
		$('#downloadTAR').attr('href',tarLink);
	}
	initEvents(){

		$('.selectMe').off('click').on('click',function(){
			console.log('elect')
			$(this).focus();
			$(this).select();
			
		})
	}
	animateLogo(){
		window.requestAnimationFrame(()=>{
			if(this.shouldRenderLogo){
				this.animateLogo();
			}

		});
		//this.controls.update();
		this.renderer.render(this.scene,this.camera);
	}
	initLogo(){
		this.shouldRenderLogo = true;
		this.scene = new THREE.Scene();
		this.scene.background =  new THREE.Color(0xeeeeee)
		this.timeGroup = new THREE.Object3D();
		this.scene.add(this.timeGroup);
		this.highlightLinesGroup = new THREE.Object3D();
		this.timeGroup.add(this.highlightLinesGroup);
		this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100000 );
		//this.camera.position.z = -100;
		//this.controls = new THREE.TrackballControls(this.camera,$('#introLogo')[0]);
		this.renderer = new THREE.WebGLRenderer({antialias:true});
		this.clock = new THREE.Clock();
		this.camera.position.x = -window.innerWidth * 2;
		//this.controls.target = new THREE.Vector3(0,0,0)
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		//this.controls.target0 = this.controls.target.clone();
		//this.controls.update();
		this.toggle = 0;
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.$el = $('#introLogo');
		$('#introLogo').append( this.renderer.domElement );
		this.animateLogo();
		var geometry = new THREE.Geometry();//new createGeom(complex)
		//var bufferGeometry = new THREE.BufferGeometry();
		geometry.dynamic = true;
		for(var i = 0;i<577;i++){
			var f0 = i *3 +0;
			var f1 = i*3 + 1;
			var f2 = i*3 + 2;
			var face = new THREE.Face3(f0,f1,f2)
			geometry.faces.push(face);
		}
		var bufferGeometry;
		console.log('geo isset logo',bufferGeometry)
		var _this = this;
		
		$.getJSON('./glsl/handshake.json',function(d){
			console.log('handshake attrs back',d);
			
			var directions = new Float32Array(d.direction.value.length*3);
			var centroids = new Float32Array(d.centroid.value.length*3);
			var vertices = d.vertices;

			d.direction.value.map(function(v,i){
				directions[i*3+0] = v.x;
				directions[i*3+1] = v.y;
				directions[i*3+2] = v.z;
				geometry.vertices.push(new THREE.Vector3(vertices[i*3+0],vertices[i*3+1],vertices[i*3+2]))
			});
			d.centroid.value.map(function(c,i){
				centroids[i*3+0] = c.x;
				centroids[i*3+1] = c.y;
				centroids[i*3+2] = c.z;
			})

				//console.log('three geometry isset',geometry);
			//console.log('centroids',centroids,directions);
			bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
			bufferGeometry.addAttribute( 'direction', new THREE.BufferAttribute( directions, 3 ) );
			bufferGeometry.addAttribute( 'centroid', new THREE.BufferAttribute( centroids, 3 ) );
			// our shader 
			
			const material = new THREE.ShaderMaterial({
				vertexShader: document.getElementById('logoVertexShader').textContent,
				fragmentShader: document.getElementById('logoFragmentShader').textContent,
				wireframe: false,
				transparent: true,
				opacity:0.5,
				color:new THREE.Color(0xffffff),
				side:THREE.DoubleSide,
				//attributes: bufferGeometry,
				uniforms: {
				  opacity: { type: 'f', value: 1 },
				  scale: { type: 'f', value: 0 },
				  animate: { type: 'f', value: 0 
				}			}
			})
			bufferGeometry.computeBoundingSphere();
			const mesh = new THREE.Mesh(bufferGeometry, material)
			mesh.rotation.setFromVector3(new THREE.Vector3(0,-Math.PI/2,0))
			_this.scene.add(mesh);
			setTimeout(function(){
				addLogoTransition(mesh);
			},100)
			
			function addLogoTransition(mesh){
				var i = 0;
				var si = setInterval(function(){
					if(i >= 1.0){
						i = 0;
						mesh.material.uniforms.animate.value = 1.0;
						mesh.material.uniforms.scale.value = 1.0;

						clearInterval(si);
						setTimeout(function(){
							removeLogo(mesh);
						},500)
						return false;
					}
					i+= 0.04;
					mesh.material.uniforms.animate.value = i;
					mesh.material.uniforms.scale.value = i;
					mesh.position.set(_this.camera.position.x+2.15,_this.camera.position.y + 0.1,_this.camera.position.z);
					//mesh.lookAt(_this.camera.position);
				},21)	
			}
			
			_this.logoMesh = mesh;
			//console.log('logo mesh',mesh)
		})
		function removeLogo(mesh){
			var i = 0;
			mesh.material.wireframe = true;
			//$('#nameList').addClass('showing');

			var si2 = setInterval(function(){
				if(i >= 1.0){
					mesh.material.uniforms.animate.value = 1.0 - i;
					mesh.material.uniforms.scale.value = 1.0 - i;

					clearInterval(si2);
					_this.cameraUnlocked = true;
					_this.shouldRenderLogo = false;
					$('#introLogo').addClass('hidden');
					$('#logo').addClass('showing');
					setTimeout(()=>{
						$('#content').addClass('showing');
					},300)
					
					//ok hide logo and stop rendering three here
					return false;
				}
				i += 0.03;
				
				mesh.material.uniforms.animate.value = 1.0-i;
				mesh.material.uniforms.scale.value = 1.0-i;
				mesh.position.set(_this.camera.position.x+2.15,_this.camera.position.y + 0.1,_this.camera.position.z);
				//mesh.lookAt(_this.camera.position);
			},21)
		}
	}
	hideLoading(){
		$('#loading').hide();
	}
}
