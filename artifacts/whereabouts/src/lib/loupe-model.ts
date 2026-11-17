import {BoxGeometry,CapsuleGeometry,CatmullRomCurve3,CylinderGeometry,Group,Mesh,SphereGeometry,TorusGeometry,TubeGeometry,Vector3,type BufferGeometry,type Material} from 'three';

/** The single homepage loupe AND holder geometry. The homepage keeps its optical shader. */
export function createLoupeAssembly(material:{dark:Material;steel:Material;red:Material;grip:Material;bracket:Material;glass:Material},ownGeometry:<T extends BufferGeometry>(geometry:T)=>T){
  const mesh=(parent:Group,geometry:BufferGeometry,paint:Material,x=0,y=0,z=0)=>{
    const object=new Mesh(ownGeometry(geometry),paint);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  };
  const loupe=new Group(),holder=new Group();
  mesh(loupe,new TorusGeometry(107,9,20,104),material.dark);
  mesh(loupe,new TorusGeometry(102,1.5,10,104),material.steel,0,0,6);
  mesh(loupe,new TorusGeometry(108,.85,8,104),material.red,0,0,9);
  mesh(loupe,new TorusGeometry(113.5,.8,8,104),material.steel,0,0,2);
  const glass=mesh(loupe,new SphereGeometry(1,72,36),material.glass,0,0,1);glass.scale.set(100,100,9);glass.castShadow=false;glass.renderOrder=2;
  const handle=new Group();handle.position.set(0,-105,0);loupe.add(handle);
  mesh(handle,new CylinderGeometry(12,11,24,24),material.steel,0,-4,0);
  mesh(handle,new CapsuleGeometry(11,88,8,20),material.grip,0,-65,-1);
  mesh(handle,new CylinderGeometry(10,10,4,24),material.dark,0,-120,-1);
  for(let i=0;i<8;i++){const groove=mesh(handle,new TorusGeometry(11,.45,6,24),material.dark,0,-38-i*7,-1);groove.rotation.x=Math.PI/2;}
  mesh(holder,new BoxGeometry(100,23,9),material.bracket,0,15,5);
  mesh(holder,new BoxGeometry(38,12,18),material.bracket,0,15,16);
  mesh(holder,new BoxGeometry(14,70,9),material.bracket,0,-20,16);
  for(const x of[-36,36]){const screw=mesh(holder,new SphereGeometry(4,20,12),material.steel,x,15,11);screw.scale.z=.45;mesh(holder,new BoxGeometry(4,.8,.5),material.bracket,x,15,13);}
  mesh(holder,new SphereGeometry(2.7,16,12),material.red,0,23.5,11);
  const curve=new CatmullRomCurve3([new Vector3(-102,45,18),new Vector3(-106,-30,24),new Vector3(0,-55,29),new Vector3(106,-30,24),new Vector3(102,45,18)]);
  mesh(holder,new TubeGeometry(curve,64,5.5,10,false),material.bracket);
  mesh(holder,new CapsuleGeometry(6,14,4,12),material.grip,-101,-6,25);mesh(holder,new CapsuleGeometry(6,14,4,12),material.grip,101,-6,25);
  return {loupe,holder,glass,handle};
}
