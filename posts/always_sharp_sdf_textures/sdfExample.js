import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/108/three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader  } from './GLTFLoader.js';

//==========
{
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

    uniform float vFilterSoftness, vBias, vFilterTolerance;
    uniform sampler2D vSDFmask;
    uniform vec2 _ScreenSize;
    uniform bool _ShowUnfiltered, _ShowPixelFootprint, _SideBySide, _ShowShowUnfiltered, _RectFilter;


    #define inverseLerp(a,b,x) ((x-a)/(b-a))
    void main() {  
        vec2 textureSize = vec2(512.0, 512.0) * 0.1;
        vec2 screencoord = gl_FragCoord.xy / _ScreenSize;
        float rawSdf = texture2D( vSDFmask, vUv ).r;
        // should apply crude correction for sRgb, but its ok for now. rawSdf *= rawSdf; 

        // calculate the derrivate of the UV coordinate
        vec2 uvDDX = dFdx(vUv);
        vec2 uvDDY = dFdy(vUv);
        float areaUnderPixelSqr = abs(uvDDX.x * uvDDY.y - uvDDX.y * uvDDY.x); // calculate the absolute determinant
        areaUnderPixelSqr *= textureSize.x * textureSize.y; // scale up uv-space to texel-space
        float areaDiameter = sqrt(areaUnderPixelSqr);
        areaDiameter = saturate(areaDiameter); // clamp the filter width to [0, 1] so we won't overfilter, which fades the texture into grey

        if(_ShowUnfiltered){
            areaDiameter = 0.5;
        }

        if(_SideBySide){
            if(screencoord.x < 0.5){
                areaDiameter = 0.5;
            }
        }

        float filteredSdf = (inverseLerp(-areaDiameter, areaDiameter, rawSdf * 2.0 - 1.0));

        gl_FragColor = mix(vec4(0.0), vec4(1.0, 1.0, 1.0, 1), filteredSdf);
       
        if(_ShowShowUnfiltered)
        {
            gl_FragColor = vec4(vec3(rawSdf), 1.0);
        }

        if(_ShowPixelFootprint){
            vec3 areaDiameterDebugColored = vec3(areaDiameter) ;
            gl_FragColor = vec4(areaDiameterDebugColored, 1.0);
        }


    }
    `;
}

//==========
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 40, screenWidth / screenHeight, 0.1, 1000 );
var parameters = {

    Tilling: 150.0,
    DisplayMode: "",
    AutoRotation: true,
}
var renderer = new THREE.WebGLRenderer( {canvas: threeJsCanvas,  antialias: true});
renderer.setSize( screenWidth, screenHeight );
renderer.setClearColor( 0xFFFFFF, 1.0 );
var maxAnisotropy = renderer.getMaxAnisotropy();

var controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

var sdfTexture = new THREE.TextureLoader().load( 'example_tex.png' );
sdfTexture.anisotropy = maxAnisotropy;
sdfTexture.wrapS = THREE.RepeatWrapping;
sdfTexture.wrapT = THREE.RepeatWrapping;
var sdfMaterial = new THREE.ShaderMaterial({  
    uniforms: {
        vTiling: {type: 'f', value: parameters.TextureTilling},
        // vBias: {type: 'f', value: parameters.sdfBias},
        // vFilterSoftness: {type: 'f', value: parameters.sdfSoftness},
        vSDFmask: {type: 't', value: sdfTexture},
        _ShowUnfiltered: new THREE.Uniform(false),
        _ShowPixelFootprint: {type: 'b', value: parameters.ShowPixelFootprint},
        // vFilterTolerance: {type: 'f', value: parameters.sdfFilterTolerance},
        _SideBySide: new THREE.Uniform(false),
        _ShowShowUnfiltered: new THREE.Uniform(false),

        _ScreenSize: new THREE.Uniform(new THREE.Vector2(screenWidth, screenHeight))

    },
    
    vertexShader: sdfShaderVS(),
    fragmentShader: sdfShaderFS(),
    side: THREE.DoubleSide,

});

var loader = new GLTFLoader();
loader.load(
	// resource URL
	'teapot.glb',
	function ( gltf ) {
        var teapot = gltf.scene.getObjectByName( "teapot" );
        // workaround: we can't use the automatic created mesh, because we will use a fundamentaly different material
        // so we create a new mesh from the loaded geometry
        var teapotWithSdf = new THREE.Mesh( teapot.geometry, sdfMaterial);
        teapotWithSdf.rotation.x = Math.PI / 2.0;
        scene.add(teapotWithSdf);
	},
);

camera.position.z = 150;

function update() {
    controls.update();

}

const 
    dMode_ParVsNoFilter = 'Constant Length vs. Parallelogram', 
   // dMode_Par = 'Lenght by Parallelogram', 
 //   dMode_PixelFootprint = 'dMode_PixelFootprint', 
  //  dMode_NoFilter = 'Constant Length',
    dMode_ShowShowUnfiltered = 'Plain Texture';

function animate() {
	requestAnimationFrame( animate );
    update();

    sdfMaterial.uniforms.vTiling.value = parameters.Tilling;
    // sdfMaterial.uniforms.vBias.value = parameters.sdfBias;
    // sdfMaterial.uniforms.vFilterSoftness.value = parameters.sdfSoftness;
   
    // sdfMaterial.uniforms.vFilterTolerance.value = parameters.sdfFilterTolerance;
    sdfMaterial.uniforms._ShowUnfiltered.value = false;
    sdfMaterial.uniforms._ShowPixelFootprint.value = false;
    sdfMaterial.uniforms._SideBySide.value = false;
    sdfMaterial.uniforms._ShowShowUnfiltered.value = false;
    switch(parameters.DisplayMode){
        case dMode_ParVsNoFilter:
            sdfMaterial.uniforms._SideBySide.value = true;
            sdfMaterial.uniforms._ShowUnfiltered.value = false;
        break;
        // case dMode_Par:
        //     sdfMaterial.uniforms._RectFilter.value = false;
        // break;
        // case dMode_PixelFootprint:
        //     sdfMaterial.uniforms._ShowPixelFootprint.value = true;
        // break;
        // case dMode_NoFilter:
        //     sdfMaterial.uniforms._ShowUnfiltered.value = true;
        // break;
        case dMode_ShowShowUnfiltered:
                sdfMaterial.uniforms._ShowShowUnfiltered.value = true;
        break;
            
    }
    controls.autoRotate = parameters.AutoRotation;

    renderer.render( scene, camera );
    
}

animate();

window.onload = function() {
    var gui = new dat.GUI({ autoPlace: false });
    var container = this.document.getElementById("datGuiContainer");
    container.appendChild(gui.domElement);
    gui.add(parameters, 'AutoRotation');
   // gui.add(parameters, 'Show Filtered');
    let modeDropdown = gui.add(parameters, 'DisplayMode', [dMode_ParVsNoFilter,  dMode_ShowShowUnfiltered]);
    gui.add(parameters, 'Tilling', 0.1, 300);

    modeDropdown.setValue(dMode_ParVsNoFilter);
 
   // gui.add(parameters, 'sdfSoftness', 0, 10);
    
  };
}
