import React, { Component }       from 'react';
// Redux
import { connect }      from 'react-redux';
// Onsen UI
import ons              from 'onsenui';
import { Page, Toolbar, List, ListItem, Button, BackButton } from 'react-onsenui';
// Styles
import styles           from '../../styles/styles';
// React Router
import { browserHistory, Link } from 'react-router';
// Subcomponents
import GenericList from './create/genericList.jsx';
// Import sampleData
import eatData from './create/sampleData/eatData.js';
import drinkData from './create/sampleData/drinkData.js';
import playData from './create/sampleData/playData.js';

const createData = [{ displayTitle: 'Eat' }, { displayTitle: 'Drink' }, { displayTitle: 'Play' }];
const categoryLabels = ['Create', 'Food', 'Beverage', 'Entertainment'];

class Create extends Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedView: 'Create',
      selectedIndex: 0,
      selectedData: createData,
      data: [createData, eatData, drinkData, playData],
    };
    this.decideTogether = this.decideTogether.bind(this);
    this.handleTouch = this.handleTouch.bind(this);
    this.handleBack = this.handleBack.bind(this);
    this.parseUniqueCategories = this.parseUniqueCategories.bind(this);
    this.parseBizByCategory = this.parseBizByCategory.bind(this);
  }

  handleTouch(item) {
    if (this.state.selectedView === 'Create') {
      const indexSelected = createData.indexOf(item) + 1;

      this.setState({
        selectedView: `${categoryLabels[indexSelected]} Categories`,
        selectedIndex: indexSelected,
        selectedData: this.parseUniqueCategories(this.state.data[indexSelected]),
      });
    } else if (this.state.selectedView.split(' ')[1] === 'Categories') {
      this.setState({
        selectedView: item.displayTitle,
      }, () => {
        this.setState({
          selectedData: this.parseBizByCategory(this.state.data[this.state.selectedIndex]),
        });
      });
    }
  }

  handleBack() {
    const selected = this.state.selectedView;
    if (selected !== 'Create') {
      if (selected.split(' ')[1] === 'Categories') {
        this.setState({
          selectedView: 'Create',
          selectedIndex: 0,
        }, () => {
          this.setState({
            selectedData: this.state.data[this.state.selectedIndex],
          });
        });
      } else {
        this.setState({
          selectedView: `${categoryLabels[this.state.selectedIndex]} Categories`,
          selectedData: this.parseUniqueCategories(this.state.data[this.state.selectedIndex]),
        });
      }
    }
  }

  // parses only yelp api
  parseUniqueCategories(dataSet) {
    return dataSet.businesses.reduce((accum, business) => {
      business.categories.forEach((item) => {
        if (!(accum.indexOf(item[0]) + 1)) accum.push(item[0]);
      });
      return accum;
    }, []).map((uniq) => {
      const newObject = {};
      newObject.displayTitle = uniq;
      return newObject;
    });
  }

  parseBizByCategory(dataSet) {
    return dataSet.businesses.reduce((accum, business) => {
      const validBiz = business.categories.reduce((accum2, category) => {
        if (category[0] === this.state.selectedView) {
          return true;
        }
        return accum2;
      }, false);
      if (validBiz) {
        const newObject = {};
        newObject.displayTitle = business.name;
        newObject.imageUrl = business.image_url;
        newObject.rating = business.rating;
        accum.push(newObject);
      }
      return accum;
    }, []);
  }

  // On Click Event
  decideTogether() {
    this.props.router.push('/plan/invite');
  }

  renderToolbar(toolbarTitle) {
    return (
      <Toolbar>
        <div className="left">
          <BackButton onClick={this.handleBack}></BackButton>
        </div>
        <div className='center' style={{ fontWeight: 'bolder' }}>{toolbarTitle}</div>
      </Toolbar>
    );
  }

  render() {
    const buttonStyle = {
      padding: '0px 20px 0px 20px',
      position: 'fixed',
      bottom: '0',
      height: '5%',
      marginBottom: '2%',
      zIndex: '5',
      marginLeft: '25%',
      width: '50%',
      textAlign: 'center',
      fontWeight: 'bold',
    };

    const padStyle = {
      height: '8%',
    };

    return (
      <div>
        <Page
          renderToolbar={() => this.renderToolbar(this.state.selectedView)}
        >
          <GenericList
            data={this.state.selectedData}
            handleTouch={this.handleTouch}
            selectedView={this.state.selectedView}
          />
          <div style={padStyle}/>
        </Page>
        <Button
          className='center'
          style={buttonStyle}
          onClick={this.decideTogether}
        >Decide Together</Button>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  hello: state.hello,
});

export default connect(mapStateToProps)(Create);
