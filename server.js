const express = require('express')
const app = express()

app.get('/', async (req, res) => {
    res.send("hiiii")
})


const tableRouter  = require('./routes/table')
app.use('/table', tableRouter)

const accountRouter = require('./routes/account')
app.use('/account', accountRouter)

//Uncomment below for local testing
//app.listen(3000, () => console.log('Server Started'))

//Uncomment below for push
app.listen(process.env.PORT || 5000 , () => console.log('Server Started'))