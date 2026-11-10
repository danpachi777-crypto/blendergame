"""Blender authored right-hand knife grip, aligned with models/knife.glb.
Run in the saved renzokugiri.blend, or with Blender --background that file --python this.
Blender +Y blade becomes glTF -Z; the right wrist extends toward glTF +X,+Z.
"""
import bpy, math, os, json, contextlib, io
from mathutils import Vector

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene=bpy.data.scenes.get('Renzokugiri_AssetStudio') or bpy.context.scene
if bpy.context.window: bpy.context.window.scene=scene
for c in list(bpy.data.collections):
    if c.name=='Renzokugiri_Hand':
        for o in list(c.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(c)
collection=bpy.data.collections.new('Renzokugiri_Hand'); scene.collection.children.link(collection)
root=bpy.data.objects.new('right_hand',None); collection.objects.link(root)

def material(name,color,rough=.5):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True; m.diffuse_color=(*color,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1); n.inputs['Roughness'].default_value=rough
    if 'Subsurface Weight' in n.inputs: n.inputs['Subsurface Weight'].default_value=.065
    return m
skin=material('Hand | warm natural skin',(.56,.315,.205),.53)
nail=material('Hand | short natural nails',(.66,.44,.35),.34)
crease=material('Hand | subtle joint crease',(.38,.19,.115),.63)
sleeve=material('Hand | charcoal chef cuff',(.027,.035,.035),.9)
thread=material('Hand | cuff edge stitching',(.11,.13,.12),.8)

def mesh(name,vs,fs,mat,parent=root):
    me=bpy.data.meshes.new(name+' mesh'); me.from_pydata(vs,[],fs); me.update()
    o=bpy.data.objects.new(name,me); collection.objects.link(o); o.data.materials.append(mat); o.parent=parent
    for p in me.polygons: p.use_smooth=True
    return o

def loft(name,centers,widths,heights,mat,sides=16):
    vs=[]; fs=[]
    for k,cc in enumerate(centers):
        c=Vector(cc)
        tangent=Vector(centers[min(k+1,len(centers)-1)])-Vector(centers[max(k-1,0)])
        tangent.normalize(); side=tangent.cross(Vector((0,0,1))).normalized(); up=side.cross(tangent).normalized()
        for j in range(sides):
            a=j*math.tau/sides
            # Slightly squarer palm profile, with rounded flanks.
            ca=math.copysign(abs(math.cos(a))**.84,math.cos(a)); sa=math.copysign(abs(math.sin(a))**.84,math.sin(a))
            p=c+side*(ca*widths[k])+up*(sa*heights[k]); vs.append(tuple(p))
    for k in range(len(centers)-1):
        for j in range(sides): fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    fs.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+j for j in range(sides))])
    return mesh(name,vs,fs,mat)

def smoothpath(points,steps=5):
    pts=[Vector(p) for p in points]; out=[]
    for i in range(len(pts)-1):
        p0=pts[max(0,i-1)];p1=pts[i];p2=pts[i+1];p3=pts[min(len(pts)-1,i+2)]
        for j in range(steps):
            t=j/steps
            out.append(tuple(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)))
    out.append(tuple(pts[-1]));return out

def tube(name,points,radii,mat,sides=12,steps=4):
    path=smoothpath(points,steps); vs=[];fs=[]
    for k,c in enumerate(path):
        i=min(k//steps,len(radii)-2); f=(k-i*steps)/steps; r=radii[i]*(1-f)+radii[i+1]*f
        tang=Vector(path[min(k+1,len(path)-1)])-Vector(path[max(k-1,0)])
        tang.normalize(); side=Vector((0,1,0)); side=(side-tang*side.dot(tang)).normalized(); up=tang.cross(side).normalized()
        for j in range(sides):
            a=j*math.tau/sides; p=Vector(c)+side*(math.cos(a)*r*.88)+up*(math.sin(a)*r)
            vs.append(tuple(p))
    for k in range(len(path)-1):
        for j in range(sides): fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    fs.extend([tuple(reversed(range(sides))),tuple((len(path)-1)*sides+j for j in range(sides))])
    return mesh(name,vs,fs,mat)

# Palm transitions from wrist into the metacarpal heads. No sphere primitives.
palm=loft('Right palm and wrist',[(.40,-.54,.015),(.34,-.46,.017),(.27,-.38,.02),(.19,-.31,.024),(.15,-.23,.025),(.135,-.14,.027),(.115,-.065,.031),(.10,-.035,.032)],
          [.068,.067,.067,.078,.095,.091,.073,.045],[.058,.057,.056,.055,.058,.058,.05,.028],skin)
# A compact forearm emerging naturally from the lower right; open end hides in cuff.
arm=loft('Right forearm',[(.36,-.49,.01),(.43,-.58,.0),(.53,-.70,-.02),(.64,-.83,-.035)],
         [.069,.075,.09,.10],[.058,.063,.076,.08],skin)
# Four digits curl around the ebony handle. Real joint taper and skin bridges at the knuckles.
skinparts=[palm,arm]
for index,(y,r) in enumerate([(-.075,.033),(-.15,.035),(-.225,.033),(-.297,.029)]):
    pts=[(.15,y,.042),(.10,y,.081),(.035,y,.105),(-.035,y,.095),(-.073,y,.052),(-.07,y,-.012),(-.03,y,-.047),(.018,y,-.038)]
    radii=[r*1.2,r*1.08,r,r*.97,r*.93,r*.85,r*.75,.009]
    o=tube(['Index','Middle','Ring','Little'][index]+' curled finger',pts,radii,skin)
    skinparts.append(o)
    # Two narrow flexion lines on the outside of each first joint.
    for off in [-.004,.004]:
        linepts=[(-.073-.0015,y-r*.54,.047+off),(-.078,y,.049+off),(-.073,y+r*.54,.047+off)]
        tube('Finger fine flexion crease',linepts,[.0006,.0008,.0006],crease,6,2)
    # Short trimmed nails at the tucked fingertip, subtle rather than decorative.
    nailpts=[(-.018,y,-.050),(-.001,y,-.047),(.010,y,-.042)]
    tube('Finger short nail',nailpts,[.010,.013,.006],nail,10,3)
# Opposed thumb crosses the top near the bolster in a firm chef grip.
thumb=tube('Right opposed thumb',[(.18,-.20,.075),(.16,-.13,.105),(.105,-.073,.119),(.045,-.030,.112),(-.004,-.021,.095)],
           [.044,.044,.038,.032,.012],skin,14,5)
skinparts.append(thumb)
tube('Thumb short nail',[(.032,-.029,.137),(.010,-.025,.125),(-.001,-.022,.111)],[.016,.015,.009],nail,12,4)
# Subtle dorsal tendon ridges follow the hand rather than separate inflated knuckles.
for i in range(3):
    tube('Dorsal tendon',[(.30,-.39,.065),(.22,-.29-i*.018,.076),(.18,-.20-i*.045,.079)],
         [.003,.004,.002],skin,8,4)

# Fuse the overlapping anatomical skin surfaces. Voxel remesh removes obvious seams.
bpy.ops.object.select_all(action='DESELECT')
for o in skinparts:o.select_set(True)
bpy.context.view_layer.objects.active=palm;bpy.ops.object.join()
joined=bpy.context.object;joined.name='Natural right hand skin'
rem=joined.modifiers.new('Continuous skin surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.0065;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=joined.modifiers.new('Relax hand skin','SMOOTH');sm.factor=.45;sm.iterations=3
bpy.ops.object.modifier_apply(modifier=sm.name)
dec=joined.modifiers.new('Mobile hand topology','DECIMATE');dec.ratio=.55
bpy.ops.object.modifier_apply(modifier=dec.name)
for p in joined.data.polygons:p.use_smooth=True

# Tailored dark sleeve with a rolled band and two understated stitch lines.
loft('Chef cuff',[(.46,-.62,-.008),(.48,-.65,-.012),(.64,-.84,-.035),(.72,-.94,-.042)],
     [.084,.088,.11,.112],[.074,.077,.09,.092],sleeve)
loft('Cuff rolled edge',[(.447,-.605,-.006),(.46,-.62,-.008),(.477,-.64,-.01)],
     [.087,.091,.09],[.077,.08,.079],sleeve)
for index,t in enumerate([0,.025]):
    c=Vector((.469+t,-.632-t,-.01)); tangent=Vector((.65,-.76,0)); side=tangent.cross(Vector((0,0,1))).normalized()
    pts=[]
    for i in range(25):
        a=i*math.tau/24;p=c+side*(math.cos(a)*.091)+Vector((0,0,1))*(math.sin(a)*.081);pts.append(tuple(p))
    tube('Cuff stitched seam',pts,[.0012]*len(pts),thread,6,1)

# Join all exported geometry; groups retain origin aligned to knife's bolster.
bpy.ops.object.select_all(action='DESELECT')
parts=[o for o in root.children_recursive if o.type=='MESH']
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=joined;bpy.ops.object.join()
merged=bpy.context.object;merged.name='right_hand_geometry';merged.parent=root
finaldec=merged.modifiers.new('Foreground mobile budget','DECIMATE');finaldec.ratio=.29
bpy.ops.object.modifier_apply(modifier=finaldec.name)
for p in merged.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);merged.select_set(True)
bpy.context.view_layer.objects.active=root
out=os.path.join(BASE,'public','models','hand.glb')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=out,use_selection=True,export_apply=True,export_extras=True)

# Match the saved studio knife transform for source inspection only, after export.
knife=bpy.data.objects.get('knife')
if knife:
    root.location=knife.location;root.rotation_euler=knife.rotation_euler
manifest_path=os.path.join(BASE,'public','models','asset-manifest.json')
with open(manifest_path) as f:manifest=json.load(f)
manifest['hand']={'file':'hand.glb','root':'right_hand','mesh':'right_hand_geometry','same_transform_as':'knife.glb','grip_center':[0,.025,.20],'wrist_direction':'+X,+Z','skin_tone':'warm medium','authored_in':'Blender'}
with open(manifest_path,'w') as f:json.dump(manifest,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'assets-src','renzokugiri.blend'))
print('HAND READY',os.path.getsize(out),'bytes,',len(merged.data.polygons),'faces')
