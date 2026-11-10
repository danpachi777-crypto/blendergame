"""Rebuild the Blender-authored mobile assets. Run in Blender's Python console.
All geometry, UVs, materials and embedded wood texture are created here.
Blender Z-up exports as glTF Y-up. Food assemblies share origin and split at X=0.
"""
import bpy, math, random, os, json
from mathutils import Vector

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
random.seed(71)
original_scene = next((s for s in bpy.data.scenes if not s.name.startswith('Renzokugiri_AssetStudio')), bpy.context.scene)
bpy.context.window.scene = original_scene
# Rebuild only this script's owned collection; preserve unrelated user scenes/data.
for old in list(bpy.data.collections):
    if old.name.startswith('Renzokugiri_Handcrafted'):
        for o in list(old.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(old)
for old in list(bpy.data.scenes):
    if old.name.startswith('Renzokugiri_AssetStudio') and old != original_scene: bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new('Renzokugiri_AssetStudio')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Renzokugiri_Handcrafted')
scene.collection.children.link(collection)

def attach(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def mat(name, rgb, rough=.45, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*rgb,1)
    n.inputs['Roughness'].default_value=rough; n.inputs['Metallic'].default_value=metal
    return m

def empty(name):
    o=bpy.data.objects.new(name,None); collection.objects.link(o); return o

def cube(name, loc, scale, material, bevel=.015, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=attach(bpy.context.object); o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Soft crafted edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    o.parent=parent; return o

def sphere(name,loc,scale,material,parent=None,segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8,radius=1,location=loc)
    o=attach(bpy.context.object); o.name=name; o.scale=scale; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    o.parent=parent; return o

def cyl(name,loc,radius,depth,material,parent=None,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=attach(bpy.context.object); o.name=name; o.data.materials.append(material); o.parent=parent
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return o

def line(name,points,radius,material,parent=None):
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.resolution_u=1
    curve.bevel_depth=radius; curve.bevel_resolution=1
    spline=curve.splines.new('POLY'); spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*co,1)
    o=bpy.data.objects.new(name,curve); collection.objects.link(o); o.data.materials.append(material); o.parent=parent
    return o

wood=mat('Walnut | oiled open grain',(.18,.085,.033),.5)
boardmat=mat('End grain hinoki',(.61,.34,.14),.58)
for material,basecol in [(wood,(.25,.13,.055)),(boardmat,(.63,.39,.19))]:
    img=bpy.data.images.new(material.name+' texture',width=256,height=256)
    pixels=[]
    for y in range(256):
        for x in range(256):
            wave=math.sin(x*.23+math.sin(y*.025)*2.7+math.sin(y*.07)*.6)
            grain=math.sin(x*1.61+math.sin(y*.035)*3)
            f=.85+wave*.11+grain*.045+random.uniform(-.04,.04)
            pixels.extend([basecol[0]*f,basecol[1]*f,basecol[2]*f,1])
    img.pixels=pixels; img.pack()
    bs=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=material.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=img
    material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
steel=mat('Brushed stainless steel',(.62,.67,.7),.22,.95)
edge=mat('Honed reflective edge',(.91,.94,.94),.12,1)
black=mat('Ebony handle',(.022,.024,.022),.3)
brass=mat('Warm brass',(.6,.36,.13),.27,.75)
tile=mat('Dark green ceramic tile',(.055,.12,.105),.33)
grout=mat('Recessed charcoal grout',(.022,.033,.03),.85)
linen=mat('Natural linen',(.71,.67,.53),.95)
ceramic=mat('Ivory ceramic',(.8,.77,.65),.24)
glass=mat('Amber glazed bottle',(.19,.1,.035),.2)

kitchen=empty('kitchen')
# Table surface exactly Z=0; plank edges, legs, board and back wall.
for i in range(8):
    cube('Walnut counter plank %02d'%i,(-2.275+i*.65,0,-.13),(.643,3.6,.26),wood,.025,kitchen)
cube('Counter front apron',(0,-1.7,-.35),(5.2,.14,.45),wood,.03,kitchen)
for x in [-2.2,2.2]:
    for y in [-1.35,1.35]: cube('Solid walnut leg',(x,y,-.9),(.15,.15,1.65),wood,.02,kitchen)
cube('Hinoki cutting board',(0,0,.05),(1.76,1.16,.1),boardmat,.045,kitchen)
for x in [-.82,.82]: cube('Board end detail',(x,0,.055),(.032,1.06,.095),wood,.008,kitchen)
# Fine shallow knife scratches on board, exported geometry instead of procedural shading.
scratchmat=mat('Knife marks',(.39,.25,.12),.78)
for i in range(22):
    x=random.uniform(-.65,.65); y=random.uniform(-.42,.42)
    line('Subtle cut mark',[(x,y,.101),(x+random.uniform(-.13,.13),y+random.uniform(.08,.23),.101)],.0007,scratchmat,kitchen)
cube('Backsplash grout',(0,1.77,.9),(5.4,.08,1.8),grout,.01,kitchen)
for row in range(5):
    for col in range(13):
        cube('Glazed subway tile',(-2.7+col*.44+(row%2)*.22,1.713,.13+row*.32),(.425,.055,.305),tile,.012,kitchen)
cube('Rear brass trim',(0,1.65,.045),(5.2,.025,.035),brass,.008,kitchen)
# Left mise-en-place linen and bowl.
cloth=cube('Folded kitchen linen',(-1.6,.65,.025),(.6,.72,.045),linen,.025,kitchen); cloth.rotation_euler.z=.12
for i in range(5): line('Linen stripe',[(-1.88+i*.10,.31,.05),(-1.88+i*.10,.97,.05)],.004,tile,kitchen)
def bowl(name,x,y,r=.22):
    # Thick ring-stack bowl; dark internal well is physically open.
    for j in range(9):
        z=.04+j*.017; rad=r*(.55+j*.055)
        bpy.ops.mesh.primitive_torus_add(major_radius=rad,minor_radius=.014,major_segments=32,minor_segments=6,location=(x,y,z))
        o=attach(bpy.context.object); o.name=name; o.data.materials.append(ceramic); o.parent=kitchen
    cyl(name+' base',(x,y,.035),r*.56,.025,ceramic,kitchen)
bowl('Ceramic prep bowl',-1.62,.64)
for i in range(8): sphere('Limes in prep bowl',(-1.62+random.uniform(-.1,.1),.64+random.uniform(-.1,.1),.16),(.055,.06,.053),mat('Lime variation %s'%i,(.15+i*.008,.27+i*.01,.035),.46),kitchen)
# Right storage: bottle, two grinders and utensil crock.
cyl('Olive oil bottle',(1.8,.96,.22),.105,.44,glass,kitchen)
cyl('Olive oil neck',(1.8,.96,.49),.04,.17,glass,kitchen)
cyl('Olive oil brass cap',(1.8,.96,.59),.045,.045,brass,kitchen)
label=mat('Bottle paper label',(.75,.67,.43),.8)
cube('Bottle label',(1.8,.853,.23),(.13,.007,.15),label,.003,kitchen)
for x in [1.15,1.43]:
    cyl('Pepper mill base',(x,1.15,.1),.075,.2,wood,kitchen)
    sphere('Pepper mill turned wood',(x,1.15,.24),(.085,.085,.13),wood,kitchen)
    cyl('Pepper mill cap',(x,1.15,.37),.067,.04,steel,kitchen)
cyl('Utensil crock',(-1.13,1.2,.15),.12,.3,ceramic,kitchen)
for i in range(4):
    x=-1.2+i*.045; line('Wood spoon handle',[(x,1.2,.12),(x-.04,1.2,.6+i*.025)],.013,boardmat,kitchen)
    sphere('Wood spoon head',(x-.04,1.2,.65+i*.025),(.033,.017,.07),boardmat,kitchen)

knife=empty('knife')
cube('Knife ebony handle',(0,-.2,.025),(.10,.4,.09),black,.028,knife)
cube('Knife bolster',(0,.015,.025),(.12,.06,.10),steel,.01,knife)
for y in [-.31,-.19,-.07]:
    riv=cyl('Flush brass rivet',(0,y,.072),.011,.003,brass,knife,16)
# Broad chef blade points +Y and the honed edge is +X.
verts=[(-.05,.04,.045),(-.05,.46,.045),(.008,.62,.025),(.14,.38,.005),(.14,.04,.005),
       (-.05,.04,.055),(-.05,.46,.055),(.008,.62,.035),(.14,.38,.015),(.14,.04,.015)]
faces=[(0,1,2,3,4),(5,9,8,7,6),(0,5,6,1),(1,6,7,2),(2,7,8,3),(3,8,9,4),(4,9,5,0)]
mesh=bpy.data.meshes.new('Forged chef blade mesh'); mesh.from_pydata(verts,[],faces); mesh.materials.append(steel)
o=bpy.data.objects.new('Forged chef blade',mesh); collection.objects.link(o); o.parent=knife
line('Polished cutting bevel',[(.14,.045,.016),(.14,.38,.016),(.008,.615,.036)],.006,edge,knife)
line('Blade spine',[(-.05,.05,.055),(-.05,.46,.055),(.008,.62,.035)],.004,steel,knife)

# Food meshes: smoothly shaded skin and planar cross-sections at the split.
foodmats={
 'cucumber':(mat('Cucumber deep skin',(.035,.19,.033),.32),mat('Cucumber pale flesh',(.62,.8,.37),.36),mat('Cucumber seed',(.84,.88,.57),.3)),
 'carrot':(mat('Carrot orange skin',(.9,.22,.018),.45),mat('Carrot crisp flesh',(1,.43,.045),.44),mat('Carrot heart',(.96,.29,.025),.5)),
 'melon':(mat('Watermelon green rind',(.07,.25,.065),.32),mat('Watermelon pink flesh',(.92,.075,.11),.3),mat('Watermelon black seed',(.025,.014,.012),.27)),
 'salmon':(mat('Salmon skin',(.18,.21,.19),.54),mat('Salmon coral flesh',(.94,.33,.19),.32),mat('Salmon fat',(.97,.77,.59),.38))}
foods={}
def profile(kind,t):
    if kind=='cucumber': return .11*(.83+.17*math.sin(math.pi*t))
    if kind=='carrot': return .13*(1-.82*t)
    if kind=='melon': return .255*max(.08,math.sin(math.pi*t))**.55
    return .15
def segfood(kind,x0,x1,parent):
    skin,flesh,seed=foodmats[kind]; length={'cucumber':.78,'carrot':.72,'melon':.75}[kind]
    h={'cucumber':.12,'carrot':.13,'melon':.255}[kind]
    rings=9; sides=32; vs=[]; fs=[]; ids=[]
    for k in range(rings):
        x=x0+(x1-x0)*k/(rings-1); t=x/length+.5; r=profile(kind,t)
        for j in range(sides):
            a=j*2*math.pi/sides; ridge=1+(0.035*math.cos(j*2*math.pi/4) if kind=='cucumber' else 0)
            vs.append((x,math.cos(a)*r*ridge,h+math.sin(a)*r))
    for k in range(rings-1):
        for j in range(sides): fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j)); ids.append(0)
    fs.append(tuple(reversed(range(sides)))); ids.append(1)
    fs.append(tuple((rings-1)*sides+j for j in range(sides))); ids.append(1)
    me=bpy.data.meshes.new(kind+' skin geometry'); me.from_pydata(vs,[],fs); me.materials.append(skin); me.materials.append(flesh)
    o=bpy.data.objects.new(kind+' skin',me); collection.objects.link(o); o.parent=parent
    for p,i in zip(me.polygons,ids): p.material_index=i; p.use_smooth=(i==0)
    # Both cross-sections get a thin pale rind and seeds; visible once halves separate.
    for x in [x0,x1]:
        if abs(x)>.001: continue
        r=profile(kind,.5); sx=x+(.0008 if x==x1 else -.0008)
        if kind=='melon':
            rindmat=mat('Watermelon white rind',(.74,.86,.43),.42)
            bpy.ops.mesh.primitive_torus_add(major_radius=r*.94,minor_radius=.011,major_segments=32,minor_segments=6,location=(sx,0,h),rotation=(0,math.pi/2,0))
            ring=attach(bpy.context.object); ring.name='Fresh watermelon rind'; ring.data.materials.append(rindmat); ring.parent=parent
            for i in range(9):
                a=i*2.399; rr=r*(.27+(i%3)*.17)
                s=sphere('Watermelon glossy black seed',(sx,math.cos(a)*rr,h+math.sin(a)*rr),(.002,.011,.019),seed,parent,12); s.rotation_euler.x=-a
        elif kind=='cucumber':
            for i in range(10):
                a=i*2.399; rr=r*.47
                s=sphere('Cucumber translucent seed',(sx,math.cos(a)*rr,h+math.sin(a)*rr),(.002,.011,.005),seed,parent,12); s.rotation_euler.x=a
        else:
            core=cyl('Carrot heart',(sx,0,h),r*.40,.001,seed,parent,24); core.rotation_euler.y=math.pi/2
    # Tiny skin speckles and growth lines.
    if kind=='cucumber':
        for i in range(32):
            x=random.uniform(x0,x1); t=x/length+.5; a=random.uniform(0,2*math.pi); r=profile(kind,t)*1.006
            sphere('Cucumber skin fleck',(x,math.cos(a)*r,h+math.sin(a)*r),(.004,.003,.002),seed,parent,8)
    if kind=='carrot':
        mark=mat('Carrot root grooves',(.58,.13,.012),.58)
        for i in range(7):
            x=x0+(x1-x0)*(i+.6)/8; r=profile(kind,x/length+.5)
            pts=[(x,math.cos(a)*r*1.005,h+math.sin(a)*r*1.005) for a in [j*.1+.6 for j in range(10)]]
            line('Carrot shallow growth line',pts,.0015,mark,parent)
    if kind=='melon':
        stripe=mat('Watermelon rind stripe',(.21,.43,.10),.42)
        for j in range(9):
            a=j*2*math.pi/9
            pts=[]
            for k in range(16):
                x=x0+(x1-x0)*k/15; r=profile(kind,x/length+.5)*1.006; w=a+.045*math.sin(k*.6)
                pts.append((x,math.cos(w)*r,h+math.sin(w)*r))
            line('Natural watermelon stripe',pts,.007,stripe,parent)

def salmon(x0,x1,parent):
    skin,flesh,fat=foodmats['salmon']
    body=cube('Salmon fresh fillet',((x0+x1)/2,0,.10),(x1-x0,.34,.20),flesh,.035,parent)
    cube('Salmon silver skin',((x0+x1)/2,0,.015),(x1-x0-.01,.33,.025),skin,.015,parent)
    for i in range(7):
        x=x0+(x1-x0)*(i+.4)/7
        pts=[(x+.028*math.cos(j*math.pi/10),-.155+j*.031,.203) for j in range(11)]
        line('Salmon ivory fat marbling',pts,.006,fat,parent)
    # Marbled cut ends at X=0, with U-shaped pale fat bands.
    for x in [x0,x1]:
        if abs(x)>.001: continue
        sx=x+(.001 if x==x1 else -.001)
        for i in range(4):
            pts=[(sx,-.15+j*.03,.045+i*.037+.012*math.cos(j*.6)) for j in range(11)]
            line('Salmon cut face marbling',pts,.004,fat,parent)

for kind in ['cucumber','carrot','salmon','melon']:
    root=empty(kind+'_asset'); foods[kind]=root
    length={'cucumber':.78,'carrot':.72,'salmon':.62,'melon':.75}[kind]
    for role,x0,x1 in [('whole',-length/2,length/2),('halfA',-length/2,0),('halfB',0,length/2)]:
        group=empty(kind+'_'+role); group.parent=root; group['role']=role
        if kind=='salmon': salmon(x0,x1,group)
        else: segfood(kind,x0,x1,group)
        if kind=='carrot' and role in ['whole','halfA']:
            leaf=mat('Carrot leafy green',(.08,.26,.035),.72)
            for i in range(5):
                a=i*1.3
                line('Carrot clipped stems',[(-length/2,0,.13),(-length/2-.09,math.cos(a)*.035,.13+math.sin(a)*.035)],.006,leaf,group)

def descendants(root): return [root]+list(root.children_recursive)
def consolidate(root):
    # One mesh per visible food part, with material slots, keeps mobile draw calls low.
    groups=list(root.children) if root.name.endswith('_asset') else [root]
    for group in groups:
        parts=[o for o in group.children_recursive if o.type in {'MESH','CURVE'}]
        if not parts: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.convert(target='MESH')
        parts=[o for o in group.children_recursive if o.type=='MESH']
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.join()
        merged=bpy.context.object; merged.name=group.name+'_geometry'; merged.parent=group
for root in [kitchen,knife]+list(foods.values()): consolidate(root)
def export(root,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in descendants(root): o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),use_selection=True,export_extras=True,export_apply=True)

export(kitchen,'kitchen'); export(knife,'knife')
for kind,root in foods.items(): export(root,kind)

# Arrange a playable art preview without modifying exported local-space assets.
for i,(kind,root) in enumerate(foods.items()):
    root.location=((-1.0+i*.67),.05,.105)
    for child in root.children:
        if child.name.endswith('_halfA') or child.name.endswith('_halfB'): child.hide_render=True; child.hide_set(True)
knife.location=(.6,-.6,.13); knife.rotation_euler.z=-.55
camdata=bpy.data.cameras.new('Chef first person camera'); cam=bpy.data.objects.new('Chef first person camera',camdata); collection.objects.link(cam)
cam.location=(0,-2.6,2.55); direction=Vector((0,.1,.05))-cam.location; cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler(); camdata.lens=34; scene.camera=cam
for name,loc,power,size,color in [('Warm softbox',(-2,-1,4),900,4,(1,.80,.60)),('Window fill',(2,.7,3.5),700,3,(.66,.8,1))]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); collection.objects.link(obj); obj.location=loc; obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Studio soft ambient'); world.use_nodes=True; world.node_tree.nodes.get('Background').inputs[0].default_value=(.17,.2,.22,1); world.node_tree.nodes.get('Background').inputs[1].default_value=.35; scene.world=world
scene.render.resolution_x=1080; scene.render.resolution_y=1440; scene.render.resolution_percentage=50
scene.render.filepath=os.path.join(BASE,'assets-src','asset-preview.png')
# Keep the original startup scene in the saved .blend, never delete user data.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'assets-src','renzokugiri.blend'))
metadata={'coordinate_system':'glTF Y-up, camera should stand at +Z looking toward -Z','kitchen':{'table_y':0,'board_y':.1,'board_width':1.76,'board_depth':1.16},'food_groups':{k:[k+'_whole',k+'_halfA',k+'_halfB'] for k in foods},'split_axis':'X','food_base_y':0,'knife':{'blade_direction':'-Z','edge_direction':'+X','length':1.02},'source_scene':scene.name,'original_scene_preserved':original_scene.name}
with open(os.path.join(OUT,'asset-manifest.json'),'w') as f: json.dump(metadata,f,indent=2)
print('ASSETS READY',json.dumps(metadata))
