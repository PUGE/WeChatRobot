"use strict";
/* jshint -W117 */
const clipboard = require('electron').clipboard;
const nativeImage = require('electron').nativeImage;
const ipcRenderer = require('electron').ipcRenderer;
const _ = require('lodash');

// 应对 微信网页偷换了console 使起失效
// 保住console引用 便于使用
window._console = window.console;

function debug(/*args*/){
	var args = JSON.stringify(_.toArray(arguments));
	_console.log(args);
}

// 禁止外层网页滚动 影响使用
document.addEventListener('DOMContentLoaded', () => {
	// document.body.style.height = '100%'
	document.body.style.overflow = 'hidden';
});

let free = true;

// 适当清理历史 缓解dom数量
function reset(){
	const msgs = $('#chatArea').scope().chatContent;
	_console.log(msgs);
	if (msgs.length >= 30) msgs.splice(0, 20);
	$('img[src*=filehelper]').closest('.chat_item')[0].click();
	free = true;
}

function onReddot($chat_item){
	if (!free) return;
	free = false;
	//将焦点移动到发来消息人的对话框
	$chat_item[0].click();
	let from,room,reply = {};

	// 自动回复 相同的内容
	const $msg = $(['.message:not(.me) .bubble_cont > div','.message:not(.me) .bubble_cont > a.app','.message:not(.me) .emoticon','.message_system'].join(', ')).last();
	const $message = $msg.closest('.message');
	const $nickname = $message.find('.nickname');
	const $titlename = $('.title_name');
	if ($nickname.length) { // 群聊
		from = $nickname.text();
		room = $titlename.text();
	} else { // 单聊
		from = $titlename.text();
		room = null;
	}
	debug('来自', from, room);// 这里的nickname会被remark覆盖
	_console.log($msg);
	// 系统消息暂时无法捕获
	// 因为不产生红点 而目前我们依靠红点 可以改善
	if ($msg.is('.message_system')) {
		_console.log("系统消息！");
		const ctn = $msg.find('.content').text();
		switch (ctn){
			case '收到红包，请在手机上查看':reply.text = '发毛红包';break;
			case '位置共享已经结束':reply.text = '位置共享已经结束';break;
			case '实时对讲已经结束':reply.text = '实时对讲已经结束';break;
			default:{
				if (ctn.match(/(.+)邀请(.+)加入了群聊/)) {
					reply.text = '加毛人';
				} else if (ctn.match(/(.+)撤回了一条消息/)) {
					reply.text = '撤你妹';
				} 
			}
		}
	} else

	if ($msg.is('.emoticon')) { // 自定义表情
		var src = $msg.find('.msg-img').prop('src');
		debug('接收', 'emoticon', src);
		reply.text = '发毛表情';
	} else if ($msg.is('.picture')) {
		var src = $msg.find('.msg-img').prop('src');
		debug('接收', 'picture', src);
		// reply.text = '发毛图片'
		reply.image = './fuck.jpeg';
	} else if ($msg.is('.location')) {
		//var src = $msg.find('.img').prop('src')
		var desc = $msg.find('.desc').text();
		debug('接收', 'location', desc);
		reply.text = desc;
	} else if ($msg.is('.attach')) {
		var title = $msg.find('.title').text();
		var size = $msg.find('span:first').text();
		var $download = $msg.find('a[download]'); // 可触发下载
		debug('接收', 'attach', title, size);
		reply.text = title + '\n' + size;
	} else if ($msg.is('.microvideo')) {
		var poster = $msg.find('img').prop('src'); // 限制
		var src = $msg.find('video').prop('src'); // 限制
		debug('接收', 'microvideo', src);
		reply.text = '发毛小视频';
	} else if ($msg.is('.video')) {
		var poster = $msg.find('.msg-img').prop('src'); // 限制
		debug('接收', 'video', src);
		reply.text = '发毛视频';
	} else if ($msg.is('.voice')) {
		$msg[0].click();
		var duration = parseInt($msg.find('.duration').text());
		var src = $('#jp_audio_1').prop('src'); // 认证限制
		var msgid = src.match(/msgid=(\d+)/)[1];
		var date = new Date().toJSON()
			.replace(/\..+/, '')
			.replace(/[\-:]/g, '')
			.replace('T', '-');
		// 20150927-164539_5656119287354277662.mp3
		var filename = `${date}_${msgid}.mp3`;
		$('<a>').attr({
			download: filename,
			href: src
		})[0].click(); // 触发下载
		debug('接收', 'voice', `${duration}s`, src);
		reply.text = '发毛语音';
	} else if ($msg.is('.card')) {
		var name = $msg.find('.display_name').text();
		var wxid = $msg.find('.signature').text();
		var img = $msg.find('.img').prop('src'); // 认证限制
		debug('接收', 'card', name, wxid);
		reply.text = name + '\n' + wxid;
	} else if ($msg.is('a.app')) {
		var url = $msg.attr('href');
		url = decodeURIComponent(url.match(/requrl=(.+?)&/)[1]);
		var title = $msg.find('.title').text();
		var desc = $msg.find('.desc').text();
		var img = $msg.find('.cover').prop('src'); // 认证限制
		debug('接收', 'link', title, desc, url);
		reply.text = title + '\n' + url;
	} else if ($msg.is('.plain')) {
		_console.log("文字消息！");
		var text = '';
		var normal = false;
		var $text = $msg.find('.js_message_plain');
		$text.contents().each(function(i, node){
			if (node.nodeType === Node.TEXT_NODE) {
				text += node.nodeValue;
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				var $el = $(node);
				if ($el.is('br')) text += '\n';
				else if ($el.is('.qqemoji, .emoji')) {
					text += $el.attr('text').replace(/_web$/, '');
				}
			}
		});
		if (text === '[收到了一个表情，请在手机上查看]' ||
				text === '[Received a sticker. View on phone]') { // 微信表情包
			text = '发毛表情';
		} else if (text === '[收到一条微信转账消息，请在手机上查看]' ||
				text === '[Received transfer. View on phone.]') {
			text = '转毛帐';
		} else if (text === '[收到一条视频/语音聊天消息，请在手机上查看]' ||
				text === '[Received video/voice chat message. View on phone.]') {
			text = '聊jj';
		} else if (text === '我发起了实时对讲') {
			text = '对讲你妹';
		} else if (text === '该类型暂不支持，请在手机上查看') {
			text = '';
		} else if (text.match(/(.+)发起了位置共享，请在手机上查看/) ||
				text.match(/(.+)started a real\-time location session\. View on phone/)) {
			text = '发毛位置共享';
		} else {
			normal = true;
		}
		debug('接收', 'text', text);
		// if (normal && !text.match(/叼|屌|diao|丢你|碉堡/i)) text = ''
		reply.text = text;
	}
	debug('回复', reply);

	// 借用clipboard 实现输入文字 更新ng-model=EditAreaCtn
	// ~~直接设#editArea的innerText无效 暂时找不到其他方法~~
	paste(reply);

	// 发送text 可以直接更新scope中的变量 @昌爷 提点
	// 但不知为毛 发不了表情
	// if (reply.image) {
	// 	paste(reply)
	// } else {
	// 	angular.element('#editArea').scope().editAreaCtn = reply.text
	// }


	// $('.web_wechat_face')[0].click()
	// $('[title=阴险]')[0].click()

	if (reply.image) {
		setTimeout(function(){
			var tryClickBtn = setInterval(function(){
				var $btn = $('.dialog_ft .btn_primary');
				if ($btn.length) {
					$('.dialog_ft .btn_primary')[0].click();
				} else {
					clearInterval(tryClickBtn);
					reset();
				}
			}, 200);
		}, 100);
	} else {
		$('.btn_send')[0].click();
		reset();
	}

}

//登录成功执行函数
function onLogin(){
	$('img[src*=filehelper]').closest('.chat_item')[0].click();
	setInterval(function(){
		const $reddot = $('.web_wechat_reddot, .web_wechat_reddot_middle').last();
		if ($reddot.length!==0) {
			const $chat_item = $reddot.closest('.chat_item');
			try {
				_console.log("----------------");
				onReddot($chat_item);
			} catch (err) { // 错误解锁
				reset();
			}
		}
	}, 200);
}

function init(){
	const checkForQrcode = setInterval(function(){
		const qrimg = document.querySelector('.qrcode img');
		if (qrimg && qrimg.src.match(/\/qrcode/)) {
			clearInterval(checkForQrcode);
		}
	}, 500);
	const checkForLogin = setInterval(function(){
		const chat_item = document.querySelector('.chat_item');
		if (chat_item) {
			onLogin();
			clearInterval(checkForLogin);
		}
	}, 500);
}



function paste(opt){
	var oldImage = clipboard.readImage();
	var oldHtml = clipboard.readHtml();
	var oldText = clipboard.readText();
	clipboard.clear(); // 必须清空
	if (opt.image) {
		// 不知为啥 linux上 clipboard+nativeimage无效
		try {
			clipboard.writeImage(nativeImage.createFromPath(opt.image));
		} catch (err) {
			opt.image = null;
			opt.text = '妈蛋 发不出图片';
		}
	}
	if (opt.html) clipboard.writeHtml(opt.html);
	if (opt.text) clipboard.writeText(opt.text);
	$('#editArea')[0].focus();
	document.execCommand('paste');
	clipboard.writeImage(oldImage);
	clipboard.writeHtml(oldHtml);
	clipboard.writeText(oldText);
}

init();