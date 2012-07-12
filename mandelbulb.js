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

var frameTime;

/* This is the main animation loop, calling the 'draw' method for each line
   When the screen is fully rendered it will call 'animateCamera()' to change the view */
function startMandelbulb() {

    /* Load the canvas */
    var mandelbulbCanvas = document.getElementById('mandelbulb');
    cHeight = mandelbulbCanvas.height;
    cWidth = mandelbulbCanvas.width;

    context = mandelbulbCanvas.getContext("2d");
    context.fillRect(0, 0, cWidth, cHeight);

    image = context.getImageData(0, 0, cWidth, cHeight);
    imageData = image.data;

    animate();
}

function animate() {

    if(currenty  == 0) {
        animateCamera();
        setupScene();
        frameTime = new Date().getTime();
    }

    // Draw some lines until we are drawing for N miliseconds, then do a callback
    // This gives the browser some CPU cycles back
    var start = new Date().getTime();
    while(currenty < cHeight && (new Date().getTime()-start) < 1000) {
        imageData = draw(imageData, currenty++);
    }

    if(currenty >= cHeight) {
	currenty = 0;
//        console.log("Took: " + (new Date().getTime() - frameTime));
	frameTime = new Date().getTime();
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

var mapZ = new FastVec3(0.0, 0.0, 0.0);
function map(z) {
    var scale = (cHeight+cWidth)/5;
    var distance = 99999999999; 
    mapZ.setTo(z).scalarMultiply(1/scale);
    distance = Math.min(distance, (mandelbulb(mapZ) * scale));
    //distance = Math.min(distance, (sphere(mapZ, new FastVec3(0.0, 0.0, 0.0), 1) * scale));
    return distance;
}

/**
 * The mandelbulb from:
 * http://blog.hvidtfeldts.net/index.php/2011/09/distance-estimated-3d-fractals-v-the-mandelbulb-different-de-approximations/
 */
var z = new FastVec3(0.0, 0.0, 0.0);
var Iterations = 20.0;
var Power = 8.0;
function mandelbulb(pos) {
    z.setTo(pos);
    var dr = 1.0;
    var r = 0.0;
    for (var i = 0; i < Iterations ; i++) {
        r = length(z);
        if (r>DEPTH_OF_FIELD) break;

        var theta = Math.acos(z.z/r);
        var phi = Math.atan2(z.y,z.x);
        dr =  Math.pow( r, Power-1.0)*Power*dr + 1.0;
        var zr = Math.pow( r,Power);
        theta = theta*Power;
        phi = phi*Power;
        z.x = Math.sin(theta)*Math.cos(phi);
        z.y = Math.sin(phi)*Math.sin(theta);
        z.z = Math.cos(theta);
        z.scalarMultiply(zr);
        z.add(pos);
    }
    return 0.5*Math.log(r)*r/dr;
}

/**
 * A simple sphere distance estimation.
 * More examples can be found here:
 * http://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
 */
var sphereZ = new FastVec3(0,0,0);
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
    var lightX = ((Math.cos(rad) * (DEPTH_OF_FIELD/2)));
    var lightZ = ((Math.sin(rad) * (DEPTH_OF_FIELD/2)));
    
    lightLocation.x = lightX;
    lightLocation.y = 40.0;
    lightLocation.z = lightZ;

    lightDirection.x = -lightLocation.x;
    lightDirection.y = -lightLocation.y;
    lightDirection.z = -lightLocation.z;
    lightDirection.normalize();
    
    var viewRad = toRad(viewAngle);
    var viewX = ((Math.cos(viewRad) * (DEPTH_OF_FIELD/2)));
    var viewZ = ((Math.sin(viewRad) * (DEPTH_OF_FIELD/2)));
    
    nearFieldLocation.x = viewX;
    nearFieldLocation.y = -20.0;
    nearFieldLocation.z = viewZ;

    viewDirection.x = -nearFieldLocation.x;
    viewDirection.y = -nearFieldLocation.y;
    viewDirection.z = -nearFieldLocation.z;
    viewDirection.normalize();

    //Place eye:
    var eyeDistanceFromNearField = 2000.0;
    
    reverseDirection.setTo(viewDirection).scalarMultiply(eyeDistanceFromNearField);
    eyeLocation.setTo(nearFieldLocation).subtract(reverseDirection);
}

/** 
 * The main draw function for a scanline
 * Make sure setupScene is called first after adjusting the camera and/or light
 */	
function draw(imageData, y) {

    	for(var x=0; x<cWidth; x++) {
        
            var nx = x - (cWidth/2.0);
            var ny = y - (cHeight/2.0);
        
            pixelLocation.setTo(nearFieldLocation);
        
            tempViewDirection.setTo(viewDirection).turnOrthogonal().scalarMultiply(nx);
            pixelLocation.add(tempViewDirection);
        
            tempViewDirection.setTo(viewDirection).turnOrthogonal().crossProduct(viewDirection).scalarMultiply(ny);
            pixelLocation.add(tempViewDirection);
        
            rayLocation.setTo(pixelLocation);
        
            rayDirection.setTo(rayLocation).subtract(eyeLocation).normalize();
        
            var distanceFromCamera = 0.0;
            var d = map(rayLocation);

            var iterations = 0;
            for(; iterations < MAX_ITER; iterations++) {
            
                if(d < halfPixel) {
                    break;
                }
        	
                //Increase rayLocation with direction and d:
                rayLocation.add(rayDirection.scalarMultiply(d));
                //And reset ray direction:
                rayDirection.normalize();

                //Move the pixel location:
                temp.setTo(nearFieldLocation).subtract(rayLocation);
                distanceFromCamera = length(temp);
                if(distanceFromCamera > DEPTH_OF_FIELD) {
                    break;
                }
                d = map(rayLocation);
            }

            if(distanceFromCamera < DEPTH_OF_FIELD) {
        	
                var locationMinX = map(rayLocation.subtract(smallX));
                var locationPlusX = map(rayLocation.add(bigX));
                rayLocation.subtract(smallX);
            	
                var locationMinY = map(rayLocation.subtract(smallY));
                var locationPlusY = map(rayLocation.add(bigY));
                rayLocation.subtract(smallY);
    
                var locationMinZ = map(rayLocation.subtract(smallZ));
                var locationPlusZ = map(rayLocation.add(bigZ));
                rayLocation.subtract(smallZ);
            	
            	//Calculate the normal:
                normal.x = (locationMinX - locationPlusX); 
                normal.y = (locationMinY - locationPlusY); 
                normal.z = (locationMinZ - locationPlusZ); 
                normal.normalize();
            	
            	//Calculate the ambient light:
                var dotNL = dotProduct(lightDirection, normal);
                var diff = saturate(dotNL);
            	
                //Calculate specular light:
                halfway.setTo(rayDirection).add(lightDirection).normalize();
    
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
            
                var pixels = (y*cWidth) + x;
                imageData[4*pixels+0] = red;
                imageData[4*pixels+1] = green;
                imageData[4*pixels+2] = blue;
//                imageData[4*pixels+3] = 255;

            } else {

                var pixels = (y*cWidth) + x;
                imageData[4*pixels+0] = 155+clamp(iterations*1.5, 0.0, 100.0);
                imageData[4*pixels+1] = 205+clamp(iterations*1.5, 0.0, 50.0);
                imageData[4*pixels+2] = 255;
//                imageData[4*pixels+3] = 255;
        	
            }
        }
    return imageData;
}

var halfPixel = Math.sqrt(2.0)/2.0;

var MAX_ITER = 5000.0;
var DEPTH_OF_FIELD = 1000.0;

var lightAngle = 140.0;
var viewAngle = 150.0;

var smallX = new FastVec3(0.01,0,0);
var smallY = new FastVec3(0,0.01,0);
var smallZ = new FastVec3(0.0, 0.0, 0.01);
var bigX = new FastVec3(0.02,0,0);
var bigY = new FastVec3(0,0.02,0);
var bigZ = new FastVec3(0.0, 0.0, 0.02);

var lightLocation = new FastVec3(0.0, 0.0, 0.0);
var lightDirection = new FastVec3(0.0, 0.0, 0.0);
var nearFieldLocation = new FastVec3(0.0, 0.0, 0.0);
var viewDirection = new FastVec3(0.0, 0.0, 0.0);
var reverseDirection = new FastVec3(0.0, 0.0, 0.0);
var eyeLocation = new FastVec3(0.0, 0.0, 0.0);
var pixelLocation = new FastVec3(0.0, 0.0, 0.0);
var rayLocation = new FastVec3(0.0, 0.0, 0.0);
var tempViewDirection = new FastVec3(0.0, 0.0, 0.0);
var rayDirection = new FastVec3(0.0, 0.0, 0.0);
var normal = new FastVec3(0.0, 0.0, 0.0);
var halfway = new FastVec3(0.0, 0.0, 0.0);
var temp = new FastVec3(0.0, 0.0, 0.0);
var ro = new FastVec3(0.0, 0.0, 0.0);
var rd = new FastVec3(0.0, 0.0, 0.0);

/**
 * In this method we calculate the 'soft' shadows
 * From: http://www.iquilezles.org/www/articles/rmshadows/rmshadows.htm
 */
function shadow(mint, maxt, k) {
    var res = 1.0;
    for(var t=mint; t < maxt; ) {
        rd.setTo(lightDirection).scalarMultiply(t);
        ro.setTo(rayLocation).subtract(rd);
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
    //lightAngle += 1.8;
    lightAngle %= 360.0;
    viewAngle += 2;
    viewAngle %= 360.0;
}

/**
 * Below are all the vector functions, vec3, Vector3D, whatever you like to call it.
 */
function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}
	
function length(otherVec) {
    var part1 = (otherVec.x) * (otherVec.x);
    var part2 = (otherVec.y) * (otherVec.y);
    var part3 = (otherVec.z) * (otherVec.z);
    var underRadical = part1 + part2 + part3;
    return Math.sqrt(underRadical);
}

function toRad(r) {
    return r * Math.PI / 180.0;
}

function saturate(n) {
    return clamp(n, 0.0, 1.0);
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
}

function FastVec3(x, y, z) {

    this.x = x;
    this.y = y;
    this.z = z;
    
    this.getNorm = function() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    this.normalize = function() {
        return this.scalarMultiply(1 / this.getNorm());
    }
    
    this.scalarMultiply = function(amount) {
        this.x *= amount;
        this.y *= amount;
        this.z *= amount;
        return this;
    }
	
    this.add = function(v1) {	
        this.x += v1.x;
        this.y += v1.y;
        this.z += v1.z;
        return this;
    }
    
    this.subtract = function(v1) {
        this.x -= v1.x;
        this.y -= v1.y;
        this.z -= v1.z;
        return this;
    }

    this.setTo = function(toMirror) {
        this.x = toMirror.x;
        this.y = toMirror.y;
        this.z = toMirror.z;
        return this;
    }

    this.turnOrthogonal = function() {    
        var inverse = 1.0 / Math.sqrt(this.x * this.x + this.z * this.z);
        var oldX = this.x;
        this.x = -inverse * this.z;
        this.z = inverse * oldX;
        return this;
    }

    this.crossProduct = function(v1) {
        var oldX = this.x;
        var oldY = this.y;
        var oldZ = this.z;
        this.x = v1.y * oldZ - v1.z * oldY;
        this.y = v1.z * oldX - v1.x * oldZ;
        this.z = v1.x * oldY - v1.y * oldX;
        return this;
    }
    
    this.clamp = function(i, min, max) {
        return Math.max(min, Math.min(i, max));
    }
    
    this.clamp = function(min, max) {
        this.x  = clamp(this.x, min, max);
        this.y  = clamp(this.y, min, max);
        this.z  = clamp(this.z, min, max);
        return this;
    }
}