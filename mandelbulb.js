/*
* To the extent possible under law, Roy van Rijn has waived all copyright and related or neighboring rights to mandelbulb.js. 
* This work is published from: Nederland.
* More information: https://github.com/royvanrijn/mandelbulb.js
* And: http://www.redcode.nl
* Feel free to add, change and use the following code, but please, keep this header included.
*/

window.onload = function() {
    startMandelbulb();
};

var currenty = 0;
var context;
var image;
var imageData;

var cHeight;
var cWidth;

/* This is the main animation loop, calling the 'draw' method for each line
   When the screen is fully rendered it will call 'animateCamera()' to change the view */
function startMandelbulb() {

    /* Load the canvas */
    var mandelbulbCanvas = document.getElementById('mandelbulb');
    cHeight = mandelbulbCanvas.height;
    cWidth = mandelbulbCanvas.width;

    context = mandelbulbCanvas.getContext("2d");
    context.fillRect(0, 0, cWidth, cHeight);

    //With a depth of field of 2.0x2.0 we calculate the pixel detail
    //This isn't using aspect ratio, nor real perspective
    pixel = (DEPTH_OF_FIELD)/((cHeight+cWidth)/2);
    halfPixel = pixel/2;

    image = context.getImageData(0, 0, cWidth, cHeight);
    imageData = image.data;

    animate();
}

var f = new Date().getTime();
function animate() {

    if(currenty  == 0) {
        animateCamera();
        setupScene();
    }

    // Draw some lines until we are drawing for N miliseconds, then do a callback
    // This gives the browser some CPU cycles back
    var start = new Date().getTime();
    while(currenty < cHeight && (new Date().getTime()-start) < 500) {
        imageData = draw(imageData, currenty++);
    }

    if(currenty >= cHeight) {
	currenty = 0;
        console.log("Took:"+(new Date().getTime()-f));
        f = new Date().getTime();
    }

    image.data = imageData;
    context.putImageData(image, 0, 0);

    requestAnimFrame(function() {
        animate();
    });

}

window.requestAnimFrame = (function(callback) {
        return window.requestAnimationFrame || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame || 
        window.oRequestAnimationFrame || 
        window.msRequestAnimationFrame ||
    function(callback) {
        window.setTimeout(callback, 0);
    };
})();


/* The 'map' method describes the complete scene (min distance to the closest object) */

var NUL = [0.0, 0.0, 0.0];
function map(z) {
    return mandelbulb(z);
    //return sphere(z, NUL, 1);
}

/**
 * The mandelbulb from:
 * http://blog.hvidtfeldts.net/index.php/2011/09/distance-estimated-3d-fractals-v-the-mandelbulb-different-de-approximations/
 */
var z = [0.0, 0.0, 0.0];
var Iterations = 20.0;
var Power = 8;
function mandelbulb(pos) {
    setTo(z, pos);
    var dr = 1.0;
    var r = 0.0;
    for (var i = 0; i < Iterations ; i++) {
        r = length(z);
        if (r>DEPTH_OF_FIELD) break;

        var theta = Math.acos(z[2]/r);
        var phi = Math.atan2(z[1],z[0]);
        dr =  Math.pow( r, Power-1.0)*Power*dr + 1.0;
        var zr = Math.pow(r,Power);
        theta = theta*Power;
        phi = phi*Power;
        var sinTheta = Math.sin(theta);
        z[0] = sinTheta*Math.cos(phi);
        z[1] = Math.sin(phi)*sinTheta;
        z[2] = Math.cos(theta);
        add(scalarMultiply(z, zr), pos);
    }
    return 0.5*Math.log(r)*r/dr;
}

/**
 * A simple sphere distance estimation.
 * More examples can be found here:
 * http://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
 */
var sphereZ = [0,0,0];
function sphere(z, sphereLocation, size) {
    sphereZ.setTo(z).subtract(sphereLocation);
    return length(sphereZ) - size;
}

/**
 * This method takes viewAngle and lightAngle and repositions:
 *
 * vec3: lightLocation
 * vec3: lightDirection
 * vec3: viewLocation
 * vec3: viewDirection
 * (and more)
 *
 */
function setupScene() {

    var rad = toRad(lightAngle);
    var lightX = ((Math.cos(rad) * DEPTH_OF_FIELD/2));
    var lightZ = ((Math.sin(rad) * DEPTH_OF_FIELD/2));
    
    lightLocation[0] = lightX;
    lightLocation[1] = (DEPTH_OF_FIELD/2);
    lightLocation[2] = lightZ;

    normalize(subtract(setTo(lightDirection, NUL), lightLocation));
    
    var viewRad = toRad(viewAngle);
    var viewX = ((Math.cos(viewRad) * DEPTH_OF_FIELD/2));
    var viewZ = ((Math.sin(viewRad) * DEPTH_OF_FIELD/2));
    
    nearFieldLocation[0] = viewX;
    nearFieldLocation[1] = 0.0;
    nearFieldLocation[2] = viewZ;

    normalize(subtract(setTo(viewDirection, NUL), nearFieldLocation));

    scalarMultiply(setTo(reverseDirection, viewDirection), eyeDistanceFromNearField);
    subtract(setTo(eyeLocation, nearFieldLocation), reverseDirection);
}

/** 
 * The main draw function for a scanline
 * Make sure setupScene is called first after adjusting the camera and/or light
 */	
function draw(imageData, y) {
        var cHalfWidth = cWidth/2;
        var ny = y - cHeight/2;

        scalarMultiply(crossProduct(turnOrthogonal(setTo(tempViewDirectionY, viewDirection)), viewDirection), ny*pixel);
	turnOrthogonal(setTo(tempViewDirectionX1, viewDirection));

    	for(var x=0; x<cWidth; x++) {
        
            var nx = x - cHalfWidth; 
        
            setTo(pixelLocation, nearFieldLocation);

            scalarMultiply(setTo(tempViewDirectionX2, tempViewDirectionX1), nx*pixel);
            add(pixelLocation, tempViewDirectionX2);
            add(pixelLocation, tempViewDirectionY);
        
            setTo(rayLocation, pixelLocation);
        
            normalize(subtract(setTo(rayDirection, rayLocation), eyeLocation));
        
            var distanceFromCamera = 0.0;
            var d = map(rayLocation);

            var iterations = 0;
            for(; iterations < MAX_ITER; iterations++) {
            
                if(d < halfPixel) {
                    break;
                }
        	
                //Increase rayLocation with direction and d:
                add(rayLocation, scalarMultiply(rayDirection, d));
                //And reset ray direction:
                normalize(rayDirection);

                //Move the pixel location:
                distanceFromCamera = length(subtract(setTo(temp, nearFieldLocation), rayLocation));

                if(distanceFromCamera > DEPTH_OF_FIELD) {
                    break;
                }
                d = map(rayLocation);
            }

            if(distanceFromCamera < DEPTH_OF_FIELD && distanceFromCamera > 0) {

                rayLocation[0] -= smallStep;
                var locationMinX = map(rayLocation);
                rayLocation[0] += bigStep;
                var locationPlusX = map(rayLocation);
                rayLocation[0] -= smallStep;
            	
                rayLocation[1] -= smallStep;
                var locationMinY = map(rayLocation);
                rayLocation[1] += bigStep;
                var locationPlusY = map(rayLocation);
                rayLocation[1] -= smallStep;

                rayLocation[2] -= smallStep;
                var locationMinZ = map(rayLocation);
                rayLocation[2] += bigStep;
                var locationPlusZ = map(rayLocation);
                rayLocation[2] -= smallStep;

            	//Calculate the normal:
                normal[0] = (locationMinX - locationPlusX); 
                normal[1] = (locationMinY - locationPlusY); 
                normal[2] = (locationMinZ - locationPlusZ); 
                normalize(normal);
            
            	//Calculate the ambient light:
                var dotNL = dotProduct(lightDirection, normal);
                var diff = saturate(dotNL);
            	
                //Calculate specular light:
                normalize(add(setTo(halfway, rayDirection), lightDirection));
    
                var dotNH = dotProduct(halfway, normal);
                var spec = Math.pow(saturate(dotNH),35);

                var shad = shadow(1.0, DEPTH_OF_FIELD, 16.0)+0.25;
                var brightness = (10.0 + (200.0 + spec * 45.0) * shad * diff) / 270.0;
            
                var red = 10+(380 * brightness);
                var green = 10+(280 * brightness);
                var blue = (180 * brightness);
            
                red = clamp(red, 0, 255.0);
                green = clamp(green, 0, 255.0);
                blue = clamp(blue, 0, 255.0);
            
                var pixels = 4 * ((y*cWidth) + x);
                imageData[pixels+0] = red;
                imageData[pixels+1] = green;
                imageData[pixels+2] = blue;
            } else {
                var pixels = 4 * ((y*cWidth) + x);
                imageData[pixels+0] = 155+clamp(iterations*1.5, 0.0, 100.0);
                imageData[pixels+1] = 205+clamp(iterations*1.5, 0.0, 50.0);
                imageData[pixels+2] = 255;
            }
        }
    return imageData;
}


var MAX_ITER = 5000.0;
var DEPTH_OF_FIELD = 2.5;
var eyeDistanceFromNearField = 2.2;

var halfPixel;
var pixel;

var lightAngle = 140.0;
var viewAngle = 150.0;

var smallStep = 0.01;
var bigStep = 0.02;

var lightLocation = [0.0, 0.0, 0.0];
var lightDirection = [0.0, 0.0, 0.0];
var nearFieldLocation = [0.0, 0.0, 0.0];
var viewDirection = [0.0, 0.0, 0.0];
var reverseDirection = [0.0, 0.0, 0.0];
var eyeLocation = [0.0, 0.0, 0.0];
var pixelLocation = [0.0, 0.0, 0.0];
var rayLocation = [0.0, 0.0, 0.0];
var tempViewDirectionX1 = [0.0, 0.0, 0.0];
var tempViewDirectionX2 = [0.0, 0.0, 0.0];
var tempViewDirectionY = [0.0, 0.0, 0.0];
var rayDirection = [0.0, 0.0, 0.0];
var normal = [0.0, 0.0, 0.0];
var halfway = [0.0, 0.0, 0.0];
var temp = [0.0, 0.0, 0.0];
var ro = [0.0, 0.0, 0.0];
var rd = [0.0, 0.0, 0.0];

/**
 * In this method we calculate the 'soft' shadows
 * From: http://www.iquilezles.org/www/articles/rmshadows/rmshadows.htm
 */
function shadow(mint, maxt, k) {
    var res = 1.0;
    for(var t=mint; t < maxt; ) {
        scalarMultiply(setTo(rd, lightDirection), t);
        subtract(setTo(ro, rayLocation), rd);
        var h = map(ro);
        if( h < 0.001) {
            return 0.0;
        }
        res = Math.min( res, k*h/t );
        t += h;
    }
    return res;
}

/**
 * Here we change the camera position and light(s)
 */
function animateCamera() {
    lightAngle += 2.0;
    lightAngle %= 360.0;
    viewAngle += 2.0;
    viewAngle %= 360.0;
}

/**
 * Below are all the vector functions, vec3, Vector3D, whatever you like to call it.
 */
function dotProduct(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function toRad(r) {
    return r * Math.PI / 180.0;
}

function saturate(n) {
    return clampVec(n, 0.0, 1.0);
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
}
    
function length(z) {
    return Math.sqrt(z[0] * z[0] + z[1] * z[1] + z[2] * z[2]);
}

function normalize(a) {
    return scalarMultiply(a, 1 / length(a));
}
    
function scalarMultiply(a, amount) {
    a[0] *= amount;
    a[1] *= amount;
    a[2] *= amount;
    return a;
}
	
function add(v1, v2) {	
    v1[0] += v2[0];
    v1[1] += v2[1];
    v1[2] += v2[2];
    return v1;
}
    
function subtract(v1, v2) {
    v1[0] -= v2[0];
    v1[1] -= v2[1];
    v1[2] -= v2[2];
    return v1;
}

function setTo(v1, v2) {
    v1[0] = v2[0];
    v1[1] = v2[1];
    v1[2] = v2[2];
    return v1;
}

function turnOrthogonal(v1) {    
    var inverse = 1.0 / Math.sqrt(v1[0] * v1[0] + v1[2] * v1[2]);
    var oldX = v1[0];
    v1[0] = -inverse * v1[2];
    v1[2] = inverse * oldX;
    return v1;
}

function crossProduct(v1, v2) {
    var oldX = v1[0];
    var oldY = v1[1];
    v1[0] = v2[1] * v1[2] - v2[2] * oldY;
    v1[1] = v2[2] * oldX - v2[0] * v1[2];
    v1[2] = v2[0] * oldY - v2[1] * oldX;
    return v1;
}
    
function clampVec(v1, min, max) {
    v1[0]  = clamp(v1[0], min, max);
    v1[1]  = clamp(v1[1], min, max);
    v1[2]  = clamp(v1[2], min, max);
    return v1;
}