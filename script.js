let maxLoads = {
  "Slick": 7200, // In pounds
  "Centerline": 9200,
  "WingTanks": 12200,
  "WingTanks+Centerline": 14000
}
let newPanels = []
let allPanels, scene, renderer, camera, animation, plane, cockpit, panelDesc
let mode = 'panels'

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
  cockPanels = text.cpPanels
  panelDesc = text.panelData

  let click

  // Load all references
  for(let i in text.ref) {
    let p = document.createElement('button')

    p.textContent = text.ref[i].name
    p.style = "display: inline; margin: 4px"

    p.onclick = function() {
      let wrapper = document.getElementById('ref-list')
      wrapper.innerHTML = ''

      for(let x in text.ref[i].steps) {
        let p = document.createElement('p')

        p.innerHTML = text.ref[i].steps[x]

        wrapper.appendChild(p)
      }
    }

    document.getElementById('button-list').appendChild(p)
    if(i == 0) click = p
  }

  click.click()

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

    plane = new THREE.Group()
    cockpit = new THREE.Group()

    scene.add(cockpit)

    const loader = new THREE.GLTFLoader();

    loader.load('./cockpit.glb', (gltf) => {
      gltf.scene.position.set(0, -20, 200)
      gltf.scene.scale.set(8, 8, 8)
      gltf.scene.rotation.x = Math.PI / -2
      gltf.scene.rotation.z = Math.PI / -2
      gltf.scene.children[0].children[9].visible = false
      cockpit.visible = false

      gltf.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.side = THREE.DoubleSide;
        }
      });

      // Add cockpit balls
      for(let i = 0; i < cockPanels.length; i++) {
        let mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 15, 15),
          new THREE.MeshBasicMaterial({color: 0xFF0000})
        )
        mesh.name = i
        mesh.position.x = cockPanels[i].cords[0]
        mesh.position.y = cockPanels[i].cords[1]
        mesh.position.z = cockPanels[i].cords[2]
        cockpit.add(mesh)
      }

      cockpit.add(gltf.scene)
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      console.error(error)
      alert('Error loading Cockpit 3D model');
    });

    loader.load('./f16.glb', (gltf) => {
      plane.add(gltf.scene)

      w.style.display = 'none'

      gltf.scene.children[0].children[0].children[0].children[5].visible = false
      gltf.scene.children[0].children[0].children[0].children[3].visible = false

      gltf.scene.traverse((child) => {
        if(child.type == 'Mesh') {
          child.material.metalness = 3
          child.material.side = THREE.DoubleSide;
        }
      })

      scene.add(plane)
      plane.name = 'plane'
    }, (xhr) => {
      let percent = (xhr.loaded / xhr.total * 100)
      s.textContent = percent + '% loaded'
      if(s.textContent == 'Infinity% loaded') {
        s.textContent = '100% loaded'
      }
    },
    (error) => {
      console.error(error)
      alert('Error loading F-16 3D model');
    });

    // Load past points from localStorage
    let value = allPanels

    for(let i in value) {
      let mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 12),
        new THREE.MeshBasicMaterial({color: 0xFF0000, opacity: 0.4, transparent: true})
      )
      mesh.name = i
      mesh.position.x = value[i].cords[0]
      mesh.position.y = value[i].cords[1]
      mesh.position.z = value[i].cords[2]
      plane.add(mesh)
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

      let intersects = raycaster.intersectObject(scene, true);

      if(intersects.length > 0) {
        if(mode == 'panels') {
          if(intersects[0].name != 'plane') {
            let panel = allPanels[intersects[0].object.name]
            alert(panel.type + ' Number: ' + panel.number)
          }
        } else if(mode == 'cockpit') {
          let format = (val) => { return Math.floor(val * 100) }
          let panel = cockPanels[intersects[0].object.name]
          document.getElementById('desccp').textContent = ''

          if(panel != undefined) {
            let wrapper = document.getElementById('cockpit-desc')
            let ident = format(panel.cords[0]) + '/' + format(panel.cords[1]) + '/' + format(panel.cords[2])

            wrapper.style.display = 'block'

            document.getElementById('cpName').style = 'color: black'
            document.getElementById('cpName').textContent = panel.title.toUpperCase()
            document.getElementById('ident').style = 'color: black; font-size: 13px; margin-top: -16px'
            document.getElementById('ident').textContent = ident

            let note = document.getElementById('cockpit-note')

            let retry = () => {
              let desc = document.getElementById('cpDesc')
              desc.innerHTML = ''

              for(let i = 0; i < panelDesc[ident].length; i++) {
                let curr = panelDesc[ident][i]

                if(curr.type == 'tab') {
                  let d = document.createElement('details')
                  let s = document.createElement('summary')
                  let p = document.createElement('p')

                  s.textContent = curr.name.toUpperCase()
                  p.textContent = curr.data.replace(/\n/g, "\n\n")

                  s.style = 'color: black; font-size: 25px'
                  p.style = "color: black"

                  d.appendChild(s)
                  d.appendChild(p)
                  desc.appendChild(d)
                } else {
                  let d = document.getElementById('desccp')

                  d.style = 'color: black'
                  d.textContent = curr.data
                }
              }
            }
            retry()

          }
        }
      }
    })
  } else {
    s.style.display = 'none'
  }
  animate()
}

function switchView() {
  let button = document.getElementById('cockpit-button')

  if(mode == 'panels') {
    // Switch to Cockpit view
    button.textContent = 'Panel Chart'
    mode = 'cockpit'
    cockpit.visible = true
    plane.visible = false

    let pos = new THREE.Vector3(29, 0.5, 200)
    camera.position.copy(pos)
    camera.position.x -= 0.1
    controls.target.copy(pos)
    controls.enableZoom = false
    controls.rotateSpeed = 1
  } else if(mode == 'cockpit') {
    // Switch to panel Chart
    button.textContent = 'View Cockpit'
    mode = 'panels'
    camera.position.set(100, 60, 100);
    cockpit.visible = false
    plane.visible = true
    controls.target.set(0, 0, 0)
    controls.enableZoom = true
  }
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
