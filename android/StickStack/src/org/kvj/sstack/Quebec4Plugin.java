package org.kvj.sstack;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.util.Log;

import com.phonegap.api.PhonegapActivity;
import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;
import com.phonegap.api.PluginResult.Status;

public class Quebec4Plugin extends Plugin {

	private static final String GET_TASKS_ACTION = "org.kvj.quebec4.action.GET_LIST";
	private static final String GET_TASKS_RESPONSE_ACTION = "org.kvj.quebec4.action.GET_LIST_RESP";
	private static final String GET_TASK_ACTION = "org.kvj.quebec4.action.GET";
	private static final String GET_TASK_RESPONSE_ACTION = "org.kvj.quebec4.action.GET_RESP";
	private static final String GOT_TASK_ACTION = "org.kvj.quebec4.action.GOT";
	private static final long OP_TIMEOUT = 4000;
	private static final String TAG = "Q4Plugin";
	private Handler handler = null;

	public Quebec4Plugin() {
		super();
		handler = new Handler();
		Log.i(TAG, "Quebec4 plugin created");
	}

	@Override
	public void setContext(PhonegapActivity ctx) {
		super.setContext(ctx);
		ctx.registerReceiver(getTaskReceiver, new IntentFilter(
				GET_TASK_RESPONSE_ACTION));
		ctx.registerReceiver(getTasksReceiver, new IntentFilter(
				GET_TASKS_RESPONSE_ACTION));
		Log.i(TAG, "Quebec4 plugin context set");
	}

	private BroadcastReceiver getTaskReceiver = new BroadcastReceiver() {

		@Override
		public void onReceive(Context context, Intent intent) {
			try {
				// Log.i(TAG,
				// "Task: " + callback + ", "
				// + intent.getStringExtra("object"));
				if (null != callback) {
					success(new PluginResult(Status.OK, new JSONObject(
							intent.getStringExtra("object"))), callback);
					callback = null;
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

	};

	private BroadcastReceiver getTasksReceiver = new BroadcastReceiver() {

		@Override
		public void onReceive(Context context, Intent intent) {
			try {
				// Log.i(TAG,
				// "Task: " + callback + ", "
				// + intent.getStringExtra("list"));
				if (null != callback) {
					success(new PluginResult(Status.OK, new JSONArray(
							intent.getStringExtra("list"))), callback);
					callback = null;
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

	};
	private String callback = null;

	@Override
	public boolean isSynch(String action) {
		if ("done".equals(action)) {
			return true;
		}
		return false;
	}

	@Override
	public PluginResult execute(String action, JSONArray params, String callback) {
		Log.i(TAG, "execute: " + action + ", " + callback + ", " + params);
		PluginResult noResult = new PluginResult(Status.NO_RESULT);
		noResult.setKeepCallback(true);
		if ("list".equals(action)) {
			startTimeoutTimer(callback);
			ctx.sendBroadcast(new Intent(GET_TASKS_ACTION));
			return noResult;
		}
		if ("get".equals(action)) {
			Intent intent = new Intent(GET_TASK_ACTION);
			try {
				intent.putExtra("id", params.getInt(0));
			} catch (JSONException e) {
				e.printStackTrace();
			}
			startTimeoutTimer(callback);
			ctx.sendBroadcast(intent);
			return noResult;
		}
		if ("done".equals(action)) {
			Intent intent = new Intent(GOT_TASK_ACTION);
			try {
				intent.putExtra("id", params.getInt(0));
			} catch (JSONException e) {
				e.printStackTrace();
			}
			ctx.sendBroadcast(intent);
			return new PluginResult(Status.OK);
		}
		return new PluginResult(Status.INVALID_ACTION);
	}

	private void startTimeoutTimer(final String _callback) {
		this.callback = _callback;
		handler.postDelayed(new Runnable() {

			@Override
			public void run() {
				// Log.i(TAG, "Timeout: " + _callback + " = " + callback);
				if (_callback.equals(callback)) {
					Log.i(TAG, "Sending error");
					callback = null;
					Quebec4Plugin.this.error("Timeout", _callback);
				}
			}
		}, OP_TIMEOUT);
	}

	@Override
	public void onDestroy() {
		super.onDestroy();
		ctx.unregisterReceiver(getTaskReceiver);
		ctx.unregisterReceiver(getTasksReceiver);
	}

}
