let maxLoads = {
  "Slick": 7200, // In pounds
  "Centerline": 9200,
  "WingTanks": 12200,
  "WingTanks+Centerline": 14000
}
let newPanels = []
let allPanels, scene, group, renderer, camera, animation
let mode = 'view'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const APP_VERSION = "1.0.0"
    const reg = navigator.serviceWorker.register(`./sw.js`, {
      scope: "./",
      updateViaCache: "none",
    })
    reg.then((data) => {
      console.log(data)
    })
  });
}

async function load() {
  let json = await fetch('./data.json')
  let text = await json.json()

  allPanels = text.panels

  for(let i in text.imds) {
    let p = document.createElement('p')

    p.innerHTML = text.imds[i]

    document.getElementById('IMDS').appendChild(p)
  }
  updateTorqueIn(0)

  let select = document.getElementById('deg')

  select.addEventListener('change', function() {
    let degA = [0, 45, 90, 135, 180, 225, 270, 315]
    let deg = degA[JSON.parse(document.getElementById('deg').value)]
    updateTorqueIn(deg)
  })

  if(!localStorage.getItem('firstLoad')) {
    localStorage.setItem('firstLoad', "true")
    document.getElementById('first').style.display = 'block'
    document.getElementById('blur-back').style.display='block'
  }
}

function isIphonePWA() {
  const isIOS = /iphone/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIOS && isStandalone && window.innerWidth < 600;
}

window.addEventListener("load", () => {
  load()

  let julian = document.getElementById('julian')
  let date = new Date()
  let start = new Date(date.getFullYear(), 0, 0);
  let diff = date - start;
  let oneDay = 1000 * 60 * 60 * 24;
  julian.textContent = "Julian Date: " + Math.floor(diff / oneDay);

  if(isIphonePWA()) {
    document.getElementById('spacer').style = 'height: 60px'
    const items = document.getElementsByClassName("x-button");

    for (let el of items) {
      el.style = "margin-top: 50px";
    }
  } else {
    document.getElementById('spacer').style = 'height: 8px'
    const items = document.getElementsByClassName("x-button");

    for (let el of items) {
      el.style = "margin-top: 8px";
    }
  }
})

function fuelLoad() {
  let total = document.getElementById('total')
  let selected = document.getElementById('config-select')
  let model = document.getElementById('model-select')
  let result = document.getElementById('fuel-res')

  let fullWeight = maxLoads[selected.value.replaceAll(' ', '')]

  if(model.value == "D Model") {
    fullWeight = fullWeight - 1250
  }

  result.innerHTML = '~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.8) * 100) / 100 + '</strong>G (JP-8) <br><br> ~<strong>' + Math.floor(((fullWeight - JSON.parse(total.value)) / 6.4) * 100) / 100 + '</strong>G (JP-4)'
  result.style = "font-size: 20px"
}

function openPanelChart() {
  let canvas = document.getElementById('panelChart')
  let c = document.querySelector('#canvas')
  let w = document.getElementById('loader-wrapper')
  let s = document.getElementById('loader-status')
  let mode3 = 0
  canvas.style.display = 'block'
  w.style.display = 'block'

  // Create scene, load 3d model, and setup orbit controls
  if(scene == undefined) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF)
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: c });
    renderer.setSize(innerWidth, innerHeight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    light = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(light);

    group = new THREE.Group()

    const loader = new THREE.GLTFLoader();

    loader.load('./f16.glb', (gltf) => {
      mesh = gltf.scene
      scene.add(gltf.scene)

      w.style.display = 'none'

      gltf.scene.children[0].children[0].children[0].children[5].visible = false
      gltf.scene.children[0].children[0].children[0].children[3].visible = false

      gltf.scene.traverse((child) => {
        if(child.type == 'Mesh') {
          child.material.metalness = 3
          child.material.side = THREE.DoubleSide;
        }
      })

      scene.add(group)
      group.name = 'plane'
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      console.error(error)
      alert('Error loading 3D model');
    });

    // Load past points from localStorage
    let value = allPanels//JSON.parse(localStorage.getItem('panels'))

    for(let i in value) {
      let mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 12),
        new THREE.MeshBasicMaterial({color: 0xFF0000, opacity: 0.4, transparent: true})
      )
      mesh.name = i
      mesh.position.x = value[i].cords[0]
      mesh.position.y = value[i].cords[1]
      mesh.position.z = value[i].cords[2]
      group.add(mesh)
    }

    camera.position.set(100, 60, 100);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const canvas3 = renderer.domElement;

    canvas3.addEventListener('click', (event) => {
      // Convert screen coordinates to NDC
      pointer.x = (event.clientX / canvas3.clientWidth) * 2 - 1;
      pointer.y = -(event.clientY / canvas3.clientHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      // Replace `targetMesh` with the mesh you want to test against
      if(mode == 'dev') {
        const intersects = raycaster.intersectObject(scene, true);

        if (intersects.length > 0) {
          if(intersects[0].object.name[0] == 'O') {
            let point = intersects[0].point;

            let hit = intersects[0];
            let vec = hit.point

            let mesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 15, 15),
              new THREE.MeshBasicMaterial({color: 0xFF0000})
            )
            mesh.position.x = vec.x
            mesh.position.y = vec.y
            mesh.position.z = vec.z
            scene.add(mesh)

            let panelNumber = prompt("Panel Number")
            let name = prompt("Panel Name")
            let type = prompt("Panel or Door")

            if(panelNumber == undefined || panelNumber == "") {
              return
            }

            newPanels.push({cords: [vec.x, vec.y, vec.z], name: name, number: panelNumber, type: type})
          } else {

            alert(allPanels[JSON.parse(intersects[0].object.name)].number + '\n' + JSON.parse(intersects[0].object.name))
          }
        }
      } else if(mode == 'view') {
        let intersects = raycaster.intersectObject(scene, true);

        if(intersects.length > 0) {
          if(intersects[0].name != 'plane') {
            let panel = allPanels[intersects[0].object.name]
            alert(panel.type + ' Number: ' + panel.number)
          }
        }
      }
    });
  } else {
    s.style.display = 'none'
  }
  animate()
}
function animate() {
  animation = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
function searchPanel() {
  let search = document.getElementById('searchPanel')

  for(let i in allPanels) {
    let curr = allPanels[i]

    if(curr.number == search.value) {
      const target = new THREE.Vector3(curr.cords[0], curr.cords[1], curr.cords[2]); // the point on the plane
      const distance = 20; // camera distance
      const scalar = new THREE.Vector3()

      scalar.z = target.z * 1.8
      scalar.x = target.x * 1.4
      scalar.y = target.y * 1.8

      camera.position.copy(scalar)
      controls.target.copy(target);
      controls.update();

      // Find the mesh and change the color
      let byName = scene.getObjectByName(i)

      byName.material.color.setHex(0x00FF00)

      window.setTimeout(function() {
        byName.material.color.setHex(0xFF0000)
      }, 5000)

      return
    }
  }
  alert('Could not find panel/door. If this panel is small, the model may not be accurate so it was not added')
}
function exportJSON() {
  console.log(JSON.stringify(newPanels))
}
function torqueSubmit() {
  let twLength = document.getElementById('tw-length')
  let exLength = document.getElementById('ex-length')
  let originTorque = document.getElementById('origin-torque')
  let degS = document.getElementById('deg')
  let degA = [0, 45, 90, 135, 180, 225, 270, 315]
  let deg = degA[JSON.parse(degS.value)]

  document.getElementById('torqueRes').textContent = Math.round(newTorque(JSON.parse(originTorque.value), deg, JSON.parse(exLength.value), JSON.parse(twLength.value)))
}

function updateTorqueIn(deg) {
  let can = document.querySelector("#torqueCanvas")
  let ctx = can.getContext('2d')

  let width = window.innerWidth
  let height = window.innerHeight

  can.width = width * 0.8
  can.height = height * 0.25

  if(can.width > 300) {
    can.width = 300
  }

  let w = (num) => {
    return (can.width * 1.5) * (num / 100)
  }
  let h = (num) => {
    return can.height * (num / 100)
  }

  ctx.strokeStyle = '#258c00'
  ctx.lineWidth = 3

  // Handle
  ctx.strokeRect(0, h(50) - (h(40) / 2), w(20), h(40))
  ctx.strokeRect(w(20), h(50) - (h(30) / 2), w(20), h(30))

  ctx.beginPath();
  ctx.arc(w(20) + (w(20)), h(50) - (h(30) / 2) + (h(30) / 2), h(15), 0, 2 * Math.PI);
  ctx.fillStyle = '#151b1f'
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w(20) + (w(20)), h(50) - (h(30) / 2) + (h(30) / 2), h(15), 0, 2 * Math.PI);
  ctx.stroke();

  let axis = [
    w(20) + (w(15)) + (w(10) / 2),
    h(50) - (h(30) / 2) + (h(15))
  ]
  // save current canvas state
  ctx.save();

  // move origin to your axis
  ctx.translate(axis[0], axis[1]);

  // rotate by degrees (convert to radians)
  ctx.rotate(deg * Math.PI / 180);

  // draw the rect *relative to new origin*
  ctx.fillRect(-w(5), -h(10), w(25), h(20));
  ctx.strokeRect(-w(5), -h(10), w(25), h(20));

  ctx.beginPath();
  ctx.arc(w(15), 0, h(7), 0, 2 * Math.PI);
  ctx.stroke();

  // restore so further drawing is unaffected
  ctx.restore();
}
function newTorque(originalTorque, angleDeg, extenderLength, wrenchLength = 10) {
  const angleRad = angleDeg * Math.PI / 180;
  return originalTorque * ((wrenchLength + extenderLength * Math.cos(angleRad)) / wrenchLength);
}
