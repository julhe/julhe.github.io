import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/108/three.module.js';
import { OrbitControls } from './OrbitControls.js';

//==========
var screenWidth = 784, screenHeight = 420;

function sdfShaderVS(){
    return `

    varying vec3 vWorldPosition;
    varying vec2 vUv;
    uniform float vTiling;
    void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;
        vUv = uv * vTiling;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `;
}


function sdfShaderFS(){
    return `

    #extension GL_OES_standard_derivatives : enable
    varying vec3 vColor;
    varying vec2 vUv;
    uniform float vFilterSoftness;
    uniform sampler2D vSDFmask;

    #define inverseLerp(a,b,x) ((x-a)/(b-a))

    void main() {  
        float cTextureScreen = texture2D( vSDFmask, vUv ).a;
        vec2 area = fwidth(vUv);
        float areaDiameter = min(area.x, area.y) * 256.0;
        areaDiameter = saturate(areaDiameter * vFilterSoftness);
        float filteredSdf = saturate(inverseLerp(-areaDiameter, areaDiameter, cTextureScreen * 2.0 - 1.0));
        gl_FragColor = vec4(filteredSdf);
    }
    `;
}

//==========
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 40, screenWidth / screenHeight, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer( {canvas: threeJsExample,  antialias: true});
renderer.setSize( screenWidth, screenHeight );
renderer.setClearColor( 0xffffff, 1 );
var maxAnisotropy = renderer.getMaxAnisotropy();

var controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.autoRotate = true;

var geometry = new THREE.PlaneBufferGeometry(20, 20, 8, 8);
var texture = new THREE.TextureLoader().load( 'Star.png' );
texture.anisotropy = maxAnisotropy;
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
var material = new THREE.ShaderMaterial({  
    uniforms: {
        vTiling: {type: 'f', value: 10.0},
        vFilterSoftness: {type: 'f', value: 1.0},
        vSDFmask: {type: 't', value: texture}
    },
    vertexShader: sdfShaderVS(),
    fragmentShader: sdfShaderFS(),
    side: THREE.DoubleSide,
  });

//var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
var cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 15;


function update() {
    controls.update();
}

function animate() {
	requestAnimationFrame( animate );
    update();
    renderer.render( scene, camera );
    
}

animate();

window.onload = function() {
    var gui = new dat.GUI({ autoPlace: false });
    var container = this.document.getElementById("theeJsExampleContainer");
    container.appendChild(gui.domElement);
    gui.add(material.uniforms.vTiling, 'value', 0.1, 30);
    gui.add(material.uniforms.vFilterSoftness, 'value', 0, 10);
  };