/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');
const Yelp = require('yelp');
const apikeys = require('./../config/yelp-api.js');

mongoose.Promise = require('bluebird');

const { Users, Events, EventGoers } = require('./letUsSchema.js');

// modular insert function
const createHash = require('hash-generator');

const savetoDB = model => model.save()
  .then(data => data)
  .catch((err) => {
    console.error('Controller error', err);
  });

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
// models to insert

const addUser = (data) => {
  const newUser = new Users({
    id: data.id,
    name: data.name,
    pic: data.pic,
    phoneNumber: (data.number) ? data.number : 0,
    friendRank: 0,
    lettuceLeaves: 0,
    friends: (data.friends.length > 0) ? data.friends.map(friend => friend.id) : [],
    favorites: [],
  });
  return newUser.save();
};

const findUser = data => Users.findOne({ id: data });

const getAllUsers = () => {
  Users.find((err, users) => {
    if (!err) {
      return users;
    }
    return err;
  });
};

const addEvent = (data) => {
  const newEvent = new Events({
    eventlord: data.eventlord,
    attendee: data.attendee,
    eventid: data.eventid,
    checkedin: data.checkedin,
  });
  savetoDB(newEvent);
};

// controllers for Invite -> Collaborate view

const retrieveEventByHash = hash => (
  Events.findOne({ linkHash: hash })
    .then((doc) => {
      if (!doc) {
        return null;
      }
      return doc;
    })
);

const retrieveEvents = (data) => {
  const hash = data.params[0];
  return retrieveEventByHash(hash);
};

const createNewHash = () => {
  const hashLength = 6;
  const hash = createHash(hashLength);

  return Events.findOne({ linkHash: hash })
    .then((doc) => {
      if (!doc) {
        return hash;
      }
      return createNewHash();
    });
};

const createEvent = (data) => {
  const newEvents = new Events({
    creator: data.body.creator,
    yelpId: data.body.yelpId,
    data: data.body.data,
    attendees: data.body.attendees,
    checkIns: data.body.checkIns,
    linkHash: data.body.hash,
  });
  return savetoDB(newEvents);
};

const addEventGoer = (user, eventId) => {
  const newEventGoers = new EventGoers({
    userId: user,
    event: eventId,
  });
  return savetoDB(newEventGoers);
};

const updateTopEvent = (data) => {
  const hash = data.body.linkHash;
  return Events.findOne({ linkHash: hash })
    .then((doc) => {
      doc.topEvent = data.body.topEvent;
      return savetoDB(doc);
    });
};

const updateEventAttendees = (data) => {
  const hash = data.body.linkHash;
  return Events.findOne({ linkHash: hash })
    .then((doc) => {
      doc.attendees = data.body.attendees;
      doc.topEvent = data.body.topEvent;
      return savetoDB(doc);
    })
    .then((event) => {
      addEventGoer(JSON.parse(event.creator).id, event._id);
      JSON.parse(event.attendees).forEach((attendee) => {
        addEventGoer(attendee.id, event._id);
      });
    });
};

const handleNewEventAttendees = (user) => {
  const hash = user.linkHash;
  delete user.linkHash;
  let isNewUser = true;
  return Events.findOne({ linkHash: hash })
    .then((doc) => {
      const attendees = JSON.parse(doc.attendees);
      attendees.forEach((item) => {
        if (item.id === user.id || user.id === undefined) {
          isNewUser = false;
        }
      });
      if (isNewUser) {
        attendees.push(user);
      }
      doc.attendees = JSON.stringify(attendees);
      return savetoDB(doc);
    })
    .then((event) => {
      if (isNewUser) {
        addEventGoer(user.id, event._id);
        return JSON.parse(event.attendees);
      }
      return null;
    });
};

const retrieveYelpData = (lat, lng) => (
  new Promise((resolve, reject) => {
    const yelp = new Yelp(apikeys);
    const cll = `${lat},${lng}`;
    // See http://www.yelp.com/developers/documentation/v2/search_api
    const queries = [{
      term: 'food',
      ll: cll,
    }, {
      term: 'nightlife',
      ll: cll,
    }, {
      term: 'active',
      ll: cll,
    }];
    // TODO: check for wrong lat and long in request
    const terms = ['eat', 'drink', 'play'];
    const dataObj = {};
    let c = 0;
    queries.forEach((searchTerm, i) => {
      yelp
        .search(searchTerm)
        .then((data) => {
          dataObj[terms[i]] = data;
          c++;
          if (c >= queries.length) {
            resolve(dataObj);
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  })
);

const retrieveCatData = (lat, lng, cat, volume) => (
  new Promise((resolve, reject) => {
    const yelp = new Yelp(apikeys);
    const cll = `${lat},${lng}`;
    const query = {
      term: cat,
      limit: volume,
      ll: cll,
    };

    yelp
      .search(query)
      .then((data) => {
        resolve(data);
      })
      .catch((err) => {
        reject(err);
      });
  })
);

const calculateVoteScore = (data, vote) => {
  const votes = data.votes;
  const score = data.preference * data.intensity * votes;
  const voteScore = vote.preference * vote.intensity;
  const newScore = score + voteScore;
  if (newScore > 0) {
    data.preference = 1;
  } else {
    data.preference = -1;
  }
  data.intensity = Math.abs(newScore / (votes + 1));
};

const handleClientVotes = (hash, vote) => (
  retrieveEventByHash(hash)
    .then((doc) => {
      const data = JSON.parse(doc.data);
      const indexVotedItem = JSON.parse(doc.data).reduce((accum, item, index) => {
        if (item.displayTitle === vote.displayTitle) {
          return index;
        }
        return accum;
      }, -1);
      const selectedData = data[indexVotedItem];
      if (!selectedData.votes) {
        selectedData.preference = vote.preference;
        selectedData.intensity = vote.intensity;
      } else {
        // Mutates input data
        calculateVoteScore(selectedData, vote);
      }
      selectedData.votes++;
      doc.data = JSON.stringify(data);
      savetoDB(doc);
      const sendToSockets = {
        displayTitle: selectedData.displayTitle,
        votes: selectedData.votes,
        intensity: selectedData.intensity,
        preference: selectedData.preference,
      };
      return sendToSockets;
    })
);

const getUserEvents = (user) => {
  const events = [];
  return new Promise((resolve) => {
    EventGoers.find({ userId: user })
      .then((data) => {
        let c = 0;
        data.forEach((eventData) => {
          Events.findOne({ _id: eventData.event })
            .then((event) => {
              if (event === null) {
                resolve([]);
                return;
              }
              events.push(event);
              c++;
              if (c >= data.length) {
                resolve(events);
              }
            });
        });
      });
  });
};

module.exports = {
  addUser,
  addEvent,
  findUser,
  getAllUsers,
  createNewHash,
  retrieveEvents,
  createEvent,
  updateEventAttendees,
  updateTopEvent,
  retrieveYelpData,
  retrieveEventByHash,
  handleClientVotes,
  getUserEvents,
  handleNewEventAttendees,
  retrieveCatData,
};
