package org.kvj.sstack;

import org.apache.cordova.api.PluginResult.Status;
import org.json.JSONArray;

import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;

public class MiscPlugin extends Plugin {

	@Override
	public boolean isSynch(String action) {
		return true;
	}

	@Override
	public PluginResult execute(String action, JSONArray params, String callback) {
		return new PluginResult(Status.ERROR);
	}

}
