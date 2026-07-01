
const res = await fetch('https://www.lennysnewsletter.com/feed', { 
  headers: { 'User-Agent': 'ThatsTheOne/1.0' } 
})
console.log('Status:', res.status)
const text = await res.text()
console.log('Length:', text.length)
console.log(text.substring(0, 1000))
