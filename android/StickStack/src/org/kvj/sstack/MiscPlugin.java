package org.kvj.sstack;

import org.json.JSONArray;

import android.content.pm.ActivityInfo;

import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;
import com.phonegap.api.PluginResult.Status;

public class MiscPlugin extends Plugin {

	@Override
	public boolean isSynch(String action) {
		return true;
	}

	private void setLandscape() {
		ctx.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
	}

	private void setPortrait() {
		ctx.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
	}

	@Override
	public PluginResult execute(String action, JSONArray params, String callback) {
		if ("landscape".equals(action)) {
			setLandscape();
			return new PluginResult(Status.OK);
		}
		if ("portrait".equals(action)) {
			setPortrait();
			return new PluginResult(Status.OK);
		}
		return new PluginResult(Status.ERROR);
	}

}
