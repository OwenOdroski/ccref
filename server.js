const express = require('express')
const app = express()
const port = 3000
const path = require('path')

app.use(express.static(path.join(__dirname, '')));

app.listen(port, '0.0.0.0', () => {
  console.log(`Example app listening on port ${port}`)
})
