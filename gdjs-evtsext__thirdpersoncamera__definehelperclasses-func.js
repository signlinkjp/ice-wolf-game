
if (typeof gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses !== "undefined") {
  gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.registeredGdjsCallbacks.forEach(callback =>
    gdjs._unregisterCallback(callback)
  );
}

gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses = {};
gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.idToCallbackMap = new Map();


gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.userFunc0x12489a0 = function GDJSInlineCode(runtimeScene, eventsFunctionContext) {
"use strict";
//@ts-ignore
if (gdjs.__thirdPersonCameraExtension) {
    //@ts-ignore
    return;
}

/**
 * It can be built the follow:
 * 
 * `objectDefaultRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2);`
 * 
 * `objectDefaultRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2));`
 * 
 */
const objectDefaultRotation = new THREE.Quaternion(0.5, -0.5, -0.5, 0.5);
const targetQuaternion = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const quaternion = new THREE.Quaternion();
const objectRotation = new THREE.Euler();

/**
 * @param object {gdjs.RuntimeObject}
 * @param ratio {number}
 * @param elevationAngleOffset {number}
 */
function slerpCamera(object, ratio, rotationAngleOffset, elevationAngleOffset) {
    const layer = object.getInstanceContainer().getLayer(object.getLayer());
    const threeCamera = layer.getRenderer().getThreeCamera();
    const threeObject = object.get3DRendererObject();

    objectRotation.copy(threeObject.rotation);
    objectRotation.z = -objectRotation.z;
    objectRotation.x = -objectRotation.x;
    targetQuaternion.setFromEuler(objectRotation);
    targetQuaternion.multiply(quaternion.setFromAxisAngle(zAxis, -gdjs.toRad(rotationAngleOffset)));
    targetQuaternion.multiply(quaternion.setFromAxisAngle(yAxis, gdjs.toRad(elevationAngleOffset)));
    targetQuaternion.multiply(objectDefaultRotation);

    threeCamera.quaternion.slerp(targetQuaternion, ratio);

    // The layer angle takes over the 3D camera Z rotation.
    layer.setCameraRotation(gdjs.toDegrees(-threeCamera.rotation.z));
}

//@ts-ignore
gdjs.__thirdPersonCameraExtension = {
    slerpCamera,
};

};
gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.eventsList0 = function(runtimeScene, eventsFunctionContext) {

{


gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.userFunc0x12489a0(runtimeScene, eventsFunctionContext);

}


};

gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.func = function(runtimeScene, parentEventsFunctionContext) {
let scopeInstanceContainer = null;
var eventsFunctionContext = {
  _objectsMap: {
},
  _objectArraysMap: {
},
  _behaviorNamesMap: {
},
  globalVariablesForExtension: runtimeScene.getGame().getVariablesForExtension("ThirdPersonCamera"),
  sceneVariablesForExtension: runtimeScene.getScene().getVariablesForExtension("ThirdPersonCamera"),
  localVariables: [],
  getObjects: function(objectName) {
    return eventsFunctionContext._objectArraysMap[objectName] || [];
  },
  getObjectsLists: function(objectName) {
    return eventsFunctionContext._objectsMap[objectName] || null;
  },
  getBehaviorName: function(behaviorName) {
    return eventsFunctionContext._behaviorNamesMap[behaviorName] || behaviorName;
  },
  createObject: function(objectName) {
    const objectsList = eventsFunctionContext._objectsMap[objectName];
    if (objectsList) {
      const object = parentEventsFunctionContext && !(scopeInstanceContainer && scopeInstanceContainer.isObjectRegistered(objectName)) ?
        parentEventsFunctionContext.createObject(objectsList.firstKey()) :
        runtimeScene.createObject(objectsList.firstKey());
      if (object) {
        objectsList.get(objectsList.firstKey()).push(object);
        if (!(scopeInstanceContainer && scopeInstanceContainer.isObjectRegistered(objectName))) {
          eventsFunctionContext._objectArraysMap[objectName].push(object);
        }
      }
      return object;
    }
    return null;
  },
  getInstancesCountOnScene: function(objectName) {
    const objectsList = eventsFunctionContext._objectsMap[objectName];
    let count = 0;
    if (objectsList) {
      for(const objectName in objectsList.items)
        count += parentEventsFunctionContext && !(scopeInstanceContainer && scopeInstanceContainer.isObjectRegistered(objectName)) ?
parentEventsFunctionContext.getInstancesCountOnScene(objectName) :
        runtimeScene.getInstancesCountOnScene(objectName);
    }
    return count;
  },
  getLayer: function(layerName) {
    return runtimeScene.getLayer(layerName);
  },
  getArgument: function(argName) {
    return "";
  },
  getOnceTriggers: function() { return runtimeScene.getOnceTriggers(); }
};


gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.eventsList0(runtimeScene, eventsFunctionContext);


return;
}

gdjs.evtsExt__ThirdPersonCamera__DefineHelperClasses.registeredGdjsCallbacks = [];