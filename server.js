const express = require('express')
const app = express()

app.get('/', async (req, res) => {
    res.send("hiiii")
})


const tableRouter  = require('./routes/table')
app.use('/table', tableRouter)

app.listen(3000, () => console.log('Server Started')) 
