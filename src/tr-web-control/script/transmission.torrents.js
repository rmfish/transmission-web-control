// Torrent related information
transmission.torrents = {
	all: null,
	puased: null,
	downloading: null,
	actively: null,
	searchResult: null,
	error: null,
	warning: null,
	folders: {},
	status: {},
	count: 0,
	totalSize: 0,
	loadSimpleInfo: false,
	activeTorrentCount: 0,
	pausedTorrentCount: 0,
	fields: {
		base: "id,name,status,hashString,totalSize,percentDone,addedDate,trackerStats,leftUntilDone,rateDownload,rateUpload,recheckProgress" + ",rateDownload,rateUpload,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,downloadDir,error,errorString,doneDate,queuePosition,activityDate",
		status: "id,name,status,totalSize,percentDone,trackerStats,leftUntilDone,rateDownload,rateUpload,recheckProgress" + ",rateDownload,rateUpload,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,error,errorString,doneDate,queuePosition,activityDate",
		config: "id,name,downloadLimit,downloadLimited,peer-limit,seedIdleLimit,seedIdleMode,seedRatioLimit,seedRatioMode,uploadLimit,uploadLimited"
	},
	site_mapping:{
		"xukong":"观众-Audies",
		"audiences":"观众-Audies",
		"btschool":"学校-btschool",
		"nginx2":"月月-FRDS",
		"keepfrds":"月月-FRDS",
		"hhanclub":"憨憨-HH",
		"et8":"TCCF",
		"pterclub":"🐱-Pter",
		"leaguehd":"🍋-League",
		"piggo":"🐷-Pigo",
		"sharkpt":"🦈-Shark",
		"springsunday":"春天-SSD",
		"m-team":"🫓-mteam",
		"upxin":"好多油-upxin",
	},
	official_torrent_name:{
		"audiences":['ADWeb','@Audies'],
		"hhanclub":['HHWEB'],
		"beitai":['BeiTai'],
		"m-team":['MTeamPAD','MTeam'],
		"sharkpt":['SharkWEB'],
		"springsunday":['CMCT'],
		"leaguehd":['LeagueWEB'],
		"et8":['BMDru'],
		"keepfrds":['FRDS'],
		"piggo":['PigoWeb']
	},
	// List of all the torrents that have been acquired
	datas: {},
	// The list of recently acquired torrents
	recently: null,
	// The recently removed seed
	removed: null,
	// Whether the torrents are being changed
	isRecentlyActive: false,
	// New torrents
	newIds: new Array(),
	btItems: [],
	getallids: function(callback, ids, moreFields) {
		var tmp = this.fields.base;
		if (this.loadSimpleInfo && this.all)
			tmp = this.fields.status;

		var fields = tmp.split(",");
		if ($.isArray(moreFields)) {
			$.unique($.merge(fields, moreFields));
		}
		var args = {
			fields: fields
		};


		this.isRecentlyActive = false;
		// If it has been acquired
		if (this.all && ids == undefined) {
			args["ids"] = "recently-active";
			this.isRecentlyActive = true;
		} else if (ids) {
			args["ids"] = ids;
		}
		if (!this.all) {
			this.all = {};
		}
		transmission.exec({
			method: "torrent-get",
			arguments: args
		}, function(data) {
			if (data.result == "success") {
				transmission.torrents.newIds.length = 0;
				transmission.torrents.loadSimpleInfo = true;
				transmission.torrents.recently = data.arguments.torrents;
				transmission.torrents.removed = data.arguments.removed;
				transmission.torrents.splitid();
				if (callback) {
					callback(data.arguments.torrents);
				}
			} else {
				transmission.torrents.datas = null;
				if (callback) {
					callback(null);
				}
			}

		});
	},
	// The IDs are sorted according to the torrent status
	splitid: function() {
		// Downloading
		this.downloading = new Array();
		// Paused
		this.puased = new Array();
		// Active lately
		this.actively = new Array();
		// With Errors
		this.error = new Array();
		// With Warnings
		this.warning = new Array();
		this.btItems = new Array();
		// All download directories used by current torrents
		if (transmission.downloadDirs == undefined){
			transmission.downloadDirs = new Array();
		}

		var _Status = transmission._status;
		this.status = {};
		transmission.trackers = {};
		this.totalSize = 0;
		this.folders = {};
		this.count = 0;

		var B64 = new Base64();

		// Merge two numbers
		for (var index in this.recently) {
			var item = this.recently[index];
			this.datas[item.id] = item;
		}

		var removed = new Array();

		// Remove the torrents that have been removed
		for (var index in this.removed) {
			var item = this.removed[index];
			removed.push(item);
		}

		// Torrents are classified
		for (var index in this.datas) {
			var item = this.datas[index];
			if (!item) {
				return;
			}
			if ($.inArray(item.id, removed) != -1 && removed.length > 0) {
				if (this.all[item.id]) {
					this.all[item.id] = null;
					delete this.all[item.id];
				}
				this.datas[index] = null;
				delete this.datas[index];

				continue;
			}
			// If the current torrent is being acquired and there is no such torrent in the previous torrent list, that is, the new torrent needs to be reloaded with the basic information
			if (this.isRecentlyActive && !this.all[item.id]) {
				this.newIds.push(item.id);
			}
			item = $.extend(this.all[item.id], item);
			// 没有活动数据时，将分享率标记为 -1
			if (item.uploadedEver == 0 && item.downloadedEver == 0) {
				item.uploadRatio = -1;
			}
			// 转为数值
			item.uploadRatio = parseFloat(item.uploadRatio);
			item.infoIsLoading = false;
			var type = this.status[item.status];
			this.addTracker(item);
			if (!type) {
				this.status[item.status] = new Array();
				type = this.status[item.status];
			}

			// Total size
			this.totalSize += item.totalSize;

			// Time left
			if (item.rateDownload > 0 && item.leftUntilDone > 0) {
				item["remainingTime"] = Math.floor(item.leftUntilDone / item.rateDownload * 1000);
			} else if (item.rateDownload == 0 && item.leftUntilDone == 0 && item.totalSize != 0) {
				item["remainingTime"] = 0;
			} else {
				// ~100 years
				item["remainingTime"] = 3153600000000;
			}


			type.push(item);
			// The seed for which the error occurred
			if (item.error != 0) {
				this.error.push(item);
			}

			// There is currently a number of seeds
			if (item.rateUpload > 0 || item.rateDownload > 0) {
				this.actively.push(item);
			}

			switch (item.status) {
				case _Status.stopped:
					this.puased.push(item);
					break;

				case _Status.download:
					this.downloading.push(item);
					break;
			}

			this.all[item.id] = item;

			// Set the directory
			if ($.inArray(item.downloadDir, transmission.downloadDirs) == -1) {
				transmission.downloadDirs.push(item.downloadDir);
			}

			if (transmission.options.getFolders) {
				if (item.downloadDir) {
					// 统一使用 / 来分隔目录
					var folder = item.downloadDir.replace(/\\/g,"/").split("/");
					var folderkey = "folders-";
					for (var i in folder) {
						var text = folder[i];
						if (text == "") {
							continue;
						}
						var key = B64.encode(text);
						// 去除特殊字符
						folderkey += key.replace(/[+|\/|=]/g,"0");
						var node = this.folders[folderkey];
						if (!node) {
							node = {
								count: 0,
								torrents: new Array(),
								size: 0,
								nodeid: folderkey
							};
						}
						node.torrents.push(item);
						node.count++;
						node.size += item.totalSize;
						this.folders[folderkey] = node;
					}
				}
			}

			this.count++;

		}
		transmission.downloadDirs = transmission.downloadDirs.sort();

		// If there a need to acquire new seeds
		if (this.newIds.length > 0) {
			this.getallids(null, this.newIds);
		}
	},
	addTracker: function(item) {
		var trackerStats = item.trackerStats;
		var trackers = [];

		item.leecherCount = 0;
		item.seederCount = 0;

		if (trackerStats.length > 0) {
			var warnings = [];
			for (var index in trackerStats) {
				var trackerInfo = trackerStats[index];
				var lastResult = trackerInfo.lastAnnounceResult.toLowerCase();
				var hostName = trackerInfo.host.getHostName();
				var trackerUrl = hostName.split(".");
				if ($.inArray(trackerUrl[0], "www,tracker,announce".split(",")) != -1) {
					trackerUrl.shift();
				}

				let name = trackerInfo.sitename;
				if(name in this.site_mapping){
					name = this.site_mapping[name];
				}
				// var name = trackerUrl.join(".");
				// var id = "tracker-" + name.replace(/\./g, "-");
				var id = "tracker-" + name;
				var tracker = transmission.trackers[id];
				if (!tracker) {
					transmission.trackers[id] = {
						count: 0,
						torrents: new Array(),
						size: 0,
						connected: true,
						isBT: (trackerStats.length>5)
					};
					tracker = transmission.trackers[id];
				}
				tracker["name"] = name;
				tracker["nodeid"] = id;
				tracker["host"] = trackerInfo.host;

				// 判断当前tracker状态
				if (!trackerInfo.lastAnnounceSucceeded && trackerInfo.announceState != transmission._trackerStatus.inactive) {
					warnings.push(trackerInfo.lastAnnounceResult);

					if (lastResult == "could not connect to tracker") {
						tracker.connected = false;
					}
				}

				if (tracker.torrents.indexOf(item)==-1) {
					tracker.torrents.push(item);
					tracker.count++;
					tracker.size += item.totalSize;
				}
				
				item.leecherCount += trackerInfo.leecherCount;
				item.seederCount += trackerInfo.seederCount;
				if (trackers.indexOf(name)==-1) {
					trackers.push(name);
				}
				if(!item['official']&&name in this.official_torrent_name){
					const suffixes = this.official_torrent_name[name]
					for(const suffix in suffixes){
						if(item['name'].includes(suffix)){
							item['official'] = true;
							break;
						}
					}
				}
			}

			if (trackerStats.length>5) {
				this.btItems.push(item);
			}

			if (warnings.length == trackerStats.length) {
				if ((warnings.join(";")).replace(/;/g,"") == ""){
					item["warning"] = "";
				} else {
					item["warning"] = warnings.join(";");
				}
				// 设置下次更新时间
				if (!item["nextAnnounceTime"])
					item["nextAnnounceTime"] = trackerInfo.nextAnnounceTime;
				else if (item["nextAnnounceTime"] > trackerInfo.nextAnnounceTime)
					item["nextAnnounceTime"] = trackerInfo.nextAnnounceTime;

				this.warning.push(item);
			}

			if (item.leecherCount < 0) item.leecherCount = 0;
			if (item.seederCount < 0) item.seederCount = 0;

			item.leecher = item.leecherCount + " (" + item.peersGettingFromUs + ")";
			item.seeder = item.seederCount + " (" + item.peersSendingToUs + ")";
			item.trackers = trackers.join(";");
		}
	},
	// 获取下载者和做种者数量测试

	getPeers: function(ids) {
		transmission.exec({
			method: "torrent-get",
			arguments: {
				fields: ("peers,peersFrom").split(","),
				ids: ids
			}
		}, function(data) {
			console.log("data:", data);
		});
	},
	// 获取更多信息

	getMoreInfos: function(fields, ids, callback) {
		transmission.exec({
			method: "torrent-get",
			arguments: {
				fields: fields.split(","),
				ids: ids
			}
		}, function(data) {
			if (data.result == "success") {
				if (callback)
					callback(data.arguments.torrents);
			} else if (callback)
				callback(null);
		});
	},
	// 从当前已获取的种子列表中搜索指定关键的种子

	search: function(key, source) {
		if (!key) {
			return null;
		}

		if (!source) {
			source = this.all;
		}

		var arrReturn = new Array();
		$.each(source, function(item, i) {
			if (source[item].name.toLowerCase().indexOf(key.toLowerCase()) != -1) {
				arrReturn.push(source[item]);
			}
		});

		this.searchResult = arrReturn;

		return arrReturn;
	},
	// 获取指定种子的文件列表

	getFiles: function(id, callback) {
		transmission.exec({
			method: "torrent-get",
			arguments: {
				fields: ("files,fileStats").split(","),
				ids: id
			}
		}, function(data) {
			if (data.result == "success") {
				if (callback)
					callback(data.arguments.torrents);
			} else if (callback)
				callback(null);
		});
	},
	// 获取指定种子的设置信息

	getConfig: function(id, callback) {
		this.getMoreInfos(this.fields.config, id, callback);
	},
	// 获取错误/警告的ID列表

	getErrorIds: function(ignore, needUpdateOnly) {
		var result = new Array();
		var now = new Date();
		if (needUpdateOnly == true) {
			now = now.getTime() / 1000;
		}
		for (var index in this.error) {
			var item = this.error[index];
			if ($.inArray(item.id, ignore) != -1 && ignore.length > 0) {
				continue;
			}
			if (needUpdateOnly == true) {
				// 当前时间没有超过“下次更新时间”时，不需要更新
				if (now < item.nextAnnounceTime) {
					continue;
				}
			}

			// 已停止的種子不計算在內
			if (item.status == transmission._status.stopped) {
				continue;
			}

			result.push(item.id);
		}

		for (var index in this.warning) {
			var item = this.warning[index];
			if ($.inArray(item.id, ignore) != -1 && ignore.length > 0) {
				continue;
			}

			if (needUpdateOnly == true) {
				// 当前时间没有超过“下次更新时间”时，不需要更新
				if (now < item.nextAnnounceTime) {
					continue;
				}
			}
			result.push(item.id);
		}

		return result;
	},
	// 查找并替換 Tracker

	searchAndReplaceTrackers: function(oldTracker, newTracker, callback) {
		if (!oldTracker || !newTracker) {
			return;
		}
		var result = {};
		var count = 0;
		for (var index in this.all) {
			var item = this.all[index];
			if (!item) {
				return;
			}
			var trackerStats = item.trackerStats;
			for (var n in trackerStats) {
				var tracker = trackerStats[n];
				if (tracker.announce == oldTracker) {
					if (!result[n]) {
						result[n] = {
							ids: new Array(),
							tracker: newTracker
						};
					}
					result[n].ids.push(item.id);
					count++;
				}
			}
		}

		if (count == 0) {
			if (callback) {
				callback(null, 0);
			}
		}
		for (var index in result) {
			transmission.exec({
				method: "torrent-set",
				arguments: {
					ids: result[index].ids,
					trackerReplace: [parseInt(index), result[index].tracker]
				}
			}, function(data, tags) {
				if (data.result == "success") {
					if (callback) {
						callback(tags, count);
					}
				} else {
					if (callback) {
						callback(null);
					}
				}
			}, result[index].ids);
		}
	},
	
	// 获取磁力链接
	getMagnetLink: function(ids, callback){
		var result = "";
		// is single number
		if(ids.constructor.name != "Array")
			ids = [ids];
		if(ids.length == 0) {
			if(callback) callback(result);
			return;
		}
		// 跳过己获取的
		var req_list = [];
		for(var id in ids){
			id = ids[id];
			if (!this.all[id]) continue;
			if (!this.all[id].magnetLink)
				req_list.push(id)
			else
				result += this.all[id].magnetLink + "\n";
		}
		
		if(req_list.length == 0){
			if(callback) callback(result.trim());
			return;
		}

		transmission.exec({
			method: "torrent-get",
			arguments: {
				fields: [ "id", "magnetLink" ],
				ids: req_list
			}
		}, function(data) {
			if (data.result == "success") {
				for(var item in data.arguments.torrents){
					item = data.arguments.torrents[item];
					transmission.torrents.all[item.id].magnetLink = item.magnetLink;
					result += item.magnetLink + "\n";
				}
				if(callback) callback(result.trim());
			}
		});
	}
};
