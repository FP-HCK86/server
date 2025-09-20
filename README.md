# server


## To test user:
1. Connect to your own DB / MongoDB Compass
2. If still using individual MongoDB, replace `MONGODB_URI=` value in .env file with your own otherwise use group MONGODB_URI

Option 1 - Using Postman
1. Register new user
Method: POST
url: http://localhost:3000/register
Body: raw
```json
{
  "username": "EmmaWatson27",
  "email": "emma@123.com",
  "password": "watson"
}
```

2. Regular User Login
METHOD: POST
url: http://localhost:3000/login
Body: raw
```json
{
  "email": "emma@123.com",
  "password": "watson"
}

3.Google Login Test
METHOD: POST
url: http://localhost:3000/google-login
Body: raw
```json
{
  "testMode": true
}

4. Check your MongoDB

Option 2 - Using Curl

1. Register User
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "EmmaWatson27",
    "email": "emma@123.com",
    "password": "watson"
  }'

2. Login User
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "emma@123.com",
    "password": "watson"
  }'

3. Access Protected Route
curl -X GET http://localhost:3000/profile \
  -H "Authorization: Bearer TOKEN_HERE"