import React from 'react';
import GameDataStore from '../stores/GameDataStore';

class UserInfo extends React.Component {
    componentDidMount() {
        console.log('userinfo,panel1');
        GameDataStore.addEventListener('UserInfoUpdate', this.forceUpdate.bind(this));
    }
    renderUserInfo() {
        return GameDataStore.getUserInfo();
    }
    render() {
        return (
            <div id="UserInfo">
                <p>个人信息</p>
                <p>{this.renderUserInfo().userName || ''} &nbsp;&nbsp;&nbsp; Lv.{this.renderUserInfo().rank || '' } {this.renderUserInfo().rankGauge}%</p>
                <p>lupi: {this.renderUserInfo().lupi || ''} &nbsp;&nbsp;&nbsp; stone: {this.renderUserInfo().stone || ''} &nbsp;&nbsp;&nbsp; rowStone: {this.renderUserInfo().rowStone || ''}</p>
                <p>jp: {this.renderUserInfo().jp || ''} &nbsp;&nbsp;&nbsp; jobLv: {this.renderUserInfo().jobLv || ''}</p>
                <p>power: {this.renderUserInfo().power || ''} &nbsp;&nbsp;&nbsp; powerLv: {this.renderUserInfo().powerLv || ''}</p>
            </div>
        );
    }
}

export default UserInfo;
