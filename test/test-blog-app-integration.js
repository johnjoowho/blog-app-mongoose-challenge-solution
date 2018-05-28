'use strict'; 

const chai = require('chai'); 
const chaiHttp = require('chai-http'); 
const faker = require('faker'); 
const mongoose = require('mongoose'); 

//this makes 'should' syntax available throughout the module
//same as chai.should(); 
const should = chai('should'); 

chai.use(chaiHttp); 


const {BlogPost} = require('../models'); 
const {app, runServer, closeServer} = require('..server'); 
const {TEST_DATABASE_URL} = require('../config'); 


//  created randomish data to test
//  uses faker library to generate placeholder values & import to mongo
//  function creates data to be used for BlogPost 
function seedBlogPostData() { 
  console.info('seeding blog post data'); 
  const seedData= []; 

  //  creates 10 new items with faker data
  //  pushes values created by faker into seedData
  for (let i=1; i<=10; i++) { 
    seedData.push({
      author: {
        firstName: faker.name.firstName(), 
        lastName: faker.name.lastName()
      }, 
      title: faker.lorem.sentence(), 
      content: faker.lorem.text()
    });
  }
  //  this returns promise, a BlogPost with 10 entries, created with seedData
  //  there are 10 seedData instances, so insertMany will insert 10 into BlogPost 
  return BlogPost.insertMany(seedData);
}

//function will disconnect from database at the end of test 
//.then results in resolve, and .catch results in reject(err) 
function tearDownDb() {
  return new Promise((resolve, reject) => {
    console.warn('Deleting database'); 
    mongoose.connection.dropDatabase()
      .then(result => resolves(result))
      .catch(err => reject(err)); 
  });
}

describe('Blog posts API resource', function() { 
  //hook functions to run server
  before(function() { 
    return runServer(TEST_DATABASE_URL); 
  });

  beforeEach(function() { 
    return seedBlogPostData(); 
  }); 
  
  afterEach(function() { 
    return tearDownDb(); 
  }); 

  after(function() { 
    return closeServer(); 
  }); 

  describe('GET endpoint', function () {

    //test GET request 
    it('should return all existing posts', function() {
      let res; 
      return chai.request(app)
        .get('/restaurants')
        .then(function(_res) {
          res = _res; 
          res.should.have.status(200); 
          res.body.should.have.lengthOf.at.least(1);

          return BlogPost.count(); 
        })
        
        //number of returned posts should be same as posts in DB 
        .then(count => {
          res.body.should.have.lengthOf(count);
        });
    });

    //test for FIELDS 
    it('should check for correct fields', function() {
      let resPost; 
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          
          //res created by .get request to ('/posts)
          //checks res body for json, array, and at least one object 
          res.should.have.status(200); 
          res.should.be.json; 
          res.body.should.be.a('array');
          res.body.should.have.lengthOf.at.least(1); 

          //here we check the fields, or keys
          //post is created by forEach function 
          res.body.forEach(function(post) { 
            post.should.be.a('object'); 
            post.should.include.keys('id', 'title', 'content', 'author', 'crated'); 
          }); 

          //check id on one item to assume rest 
          //creates resPost with the first item in the body 
          resPost = res.body[0]; 

          //takes resPost's id and searches BlogPost by id
          return BlogPost.findById(resPost.id); 
        })

        //now test if returned object matches resPost's properties  
        //post is the returned object being compared to resPost
        .then(post => {
          resPost.title.should.equal(post.title); 
          
          //authorName?  or 'author'? author is an obj with first and last name 
          resPost.author.should.equal(post.authorName); 
        });
      }); 
    });


    //testing all POST requests to server 
    describe('POST endpoint', function() { 
      
      //create a faker post object and test returned object and ID 
      it('should add a new blog post', function () { 

        //here is the post test object 
        //newPost refers to new post request
        const newPost = {
          title: faker.lorem.sentence(), 
          author: { 
            firstName: faker.name.firstName(), 
            lastName: faker.name.lastName() , 
          }, 
          content: faker.lorem.text()
        }; 

        //collecting returned data from POST requests to '/posts'
        return chai.request(app) 
          
          //POSTs request to endpoint '/posts'
          .post('/posts') 

          //sends newPost to posts 
          .send(newPost)

          //newPost is returned from database as res, now to check res against newPost(the request)
          .then(function(res) {

            //checking res (new object found in db) body for header basic info 
            res.should.have.status(201); 
            res.should.be.json; 
            res.body.should.be.a('object'); 
            res.body.should.include.keys( 
              'id', 'title', 'content', 'author', 'created'); 

            //testing values for the new input 
            res.body.title.should.equal(newPost.title); 

            //mongo should have created id 
            res.body.id.should.not.be.null; 
            res.body.author.should.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);
            res.body.content.should.equal(newPost.content); 
            return BlogPost.findById(res.body.id);
          })

          //now test the item this time searched by ID, against newPost(which was our request)
          //being returned by ID means that the item was actually created and posted to DB 
          .then(function (post) {
            post.title.should.equal(newPost.title); 
            post.content.should.equal(newPost.content); 
            post.author.firstName.should.equal(newPost.author.FirstName); 
            post.author.lastName.should.equal(newPost.author.lastName); 
          }); 
      }); 
    }); 

    //now we are testing PUT requests, aka updates or replacements
    describe('PUT endpoint', function() { 
      it('should update fields you enter with new info', function() {
        
        //creating test update values/fields
        const updateData = { 
          title: 'This is the best blog ever', 
          content: faker.lorem.text, 
          author: { 
            firstName: 'Abraham', 
            lastName: 'Lincoln'
          }
        }; 

        //now finding a randon blog post to update with data from updateData
        //returns BlogPost DB, picks one (first) post, and assigns its id to updateData's id 
        return BlogPost
          .findOne()
          .then(post => {
            updateData.id = post.id; 
  
            //sends updateData to its new id endpoint, replacing old original item
            return chai.request(app)
              .put(`/posts/${post.id}`)
              .send(updateData); 
          })

          //now make sure post was made and return the object by new assigned id
          .then(res => {
            res.should.have.status(204); 
            return BlogPost.findById(updateData.id); 
          })
          //takes the blog post returned by id search and tests against input values, or updateData
          .then(post => {
            post.title.should.equal(updateData.title); 
            post.content.should.equal(updateData.content); 
            post.author.firstName.should.equal(updateaData.author.firstName); 
            post.author.lastName.should.equal(updateaData.author.lastName); 
          });
      });
    }); 

    describe('DELETE endpoint', function() { 
      it('should delete a post by id', function() { 
        let post; 

        return BlogPost
          .findOne()
          .then(_post => {
            post = _post; 
            return chai.request(app).delete(`/posts/${post.id}`);
          })
          .then(res => {
            res.should.have.status(204); 
            return BlogPost.findById(post.id); 
          })
          .then(_post => {
            should.not.exist(_post); 
          });
      });
    });
}); 
